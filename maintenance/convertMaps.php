<?php
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Extension\DataMaps\Content\DataMapContent;
use MediaWiki\Extension\DataMaps\Content\SchemaProvider;
use MediaWiki\Extension\DataMaps\Rendering\Utils\DataMapFileUtils;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IMaintainableDatabase;
use Wikimedia\Rdbms\LBFactory;

require_once __DIR__ . '/../../../maintenance/Maintenance.php';

class ConvertMaps extends Maintenance {
    /** @var IMaintainableDatabase */
    private $dbw;
    /** @var LBFactory */
    private $lbFactory;
    /** @var User */
    private $commitUser;

    public function __construct() {
        parent::__construct();
        $this->addDescription( 'Convert Fandom maps to DataMaps format.' );
        $this->addOption( 'user', 'Username to which conversion edits should be attributed. Default: "Maintenance script"',
            false, true, 'u' );
    }

    public function execute() {
        // find in namespace
        // swap content model to json for all revisions
        // go over pages, if latest revision isn't datamap, convert

        // We need master database access
        $this->dbw = $this->getDB( DB_PRIMARY );
        $this->lbFactory = MediaWikiServices::getInstance()->getDBLoadBalancerFactory();

        // Prepare user to save revisions as
        $userName = $this->getOption( 'user', false );
        if ( $userName === false ) {
            $this->commitUser = User::newSystemUser( User::MAINTENANCE_SCRIPT_USER, [ 'steal' => true ] );
        } else {
            $this->commitUser = MediaWikiServices::getInstance()->getUserFactory()->newFromName( $userName );
        }
        if ( !$this->commitUser ) {
            $this->fatalError( 'Invalid username' );
        }

        // Query pages in the Map (2900) namespace
        $this->output( "Searching for pages to convert...\n" );
        $pageRows = $this->dbw->newSelectQueryBuilder()
            ->select( [
                'page_id',
                'page_title',
                'page_content_model'
            ] )
            ->from( 'page' )
            ->where( [
                'page_namespace' => 2900,
                'page_content_model != "wikitext"'
            ] )
            ->caller( __METHOD__ )
            ->fetchResultSet();

        // Update default content model for every page
        $this->output( "Overriding default content models to DataMap...\n" );
        foreach ( $pageRows as $pageRow ) {
            $this->output( "  ... " . $pageRow->page_title . "\n" );
            $this->dbw->update(
                'page',
                [ 'page_content_model' => CONTENT_MODEL_DATAMAPS ],
                [ 'page_id' => $pageRow->page_id ],
                __METHOD__
            );
            $this->lbFactory->waitForReplication();
        }

        // Get content model IDs ahead of time
        $contentModelStore = MediaWikiServices::getInstance()->getContentModelStore();
        $cmDataMapId = $contentModelStore->acquireId( CONTENT_MODEL_DATAMAPS );
        $cmJsonId = $contentModelStore->acquireId( CONTENT_MODEL_JSON );
        // In case there's redirection pages:
        $cmWikitextId = $contentModelStore->acquireId( CONTENT_MODEL_WIKITEXT );

        // Update ALL revisions of found pages to the JSON content model
        $this->output( "Setting content model to JSON for all revisions\n" );
        foreach ( $pageRows as $pageRow ) {
            $this->output( "  ... " . $pageRow->page_title . ": " );
            $contentRows = $this->dbw->newSelectQueryBuilder()
                ->select( [
                    'content_id',
                    'content_model'
                ] )
                ->from( 'content' )
                ->join( 'slots', null, [ 'content_id = slot_content_id' ] )
                ->join( 'revision', null, [ 'slot_revision_id = rev_id' ] )
                ->where( [
                    'rev_page' => $pageRow->page_id,
                    'content_model != ' . $cmDataMapId,
                    'content_model != ' . $cmWikitextId
                ] )
                ->caller( __METHOD__ )
                ->fetchResultSet();

            $this->output( " " . count( $contentRows ) . " content rows\n" );
            $this->beginTransaction( $this->dbw, __METHOD__ );
            foreach ( $contentRows as $contentRow ) {
                if ( $contentRow->content_model != $cmJsonId && $contentRow->content_model != $cmWikitextId ) {
                    $this->dbw->update(
                        'content',
                        [ 'content_model' => $cmJsonId ],
                        [ 'content_id' => $contentRow->content_id ],
                        __METHOD__
                    );
                }
            }
            $this->commitTransaction( $this->dbw, __METHOD__ );
            $this->lbFactory->waitForReplication();
        }

        // Convert latest revisions to the data map format (as a new revision)
        $this->output( "Converting latest revisions\n" );
        foreach ( $pageRows as $pageRow ) {
            $this->output( "  ... " . $pageRow->page_title . ": " );
            $this->convertPage( $pageRow->page_id );
        }
    }

    private function convertPage( int $pageId ) {
        // Grab page
        $page = MediaWikiServices::getInstance()->getWikiPageFactory()->newFromID( $pageId );
        // Grab latest revision
        $revRecord = $page->getRevisionRecord();

        if ( !$revRecord ) {
            $this->output( "no revision records.\n" );
            return;
        }

        // Grab content
        $content = $revRecord->getContent( SlotRecord::MAIN, RevisionRecord::RAW );

        if ( $content instanceof DataMapContent ) {
            $this->output( "already a data map.\n" );
            return;
        }

        if ( !( $content instanceof JsonContent ) ) {
            $this->output( "not JSON.\n" );
            return;
        }

        // Retrieve the data
        if ( !$content->isValid() ) {
            $this->output( "invalid JSON, not converting.\n" );
            return;
        }
        $fmData = $content->getData()->getValue();

        // Convert into DataMaps format
        $this->output( "attempting conversion\n" );
        $dmData = $this->convertObject( $fmData );

        if ( !$dmData ) {
            return;
        }

        $this->output( "    ... saving\n" );
        $content = new DataMapContent( DataMapContent::toJSON( $dmData ) );

        // Do the edit
        $updater = $page->newPageUpdater( $this->commitUser );
        $updater->setContent( SlotRecord::MAIN, $content );
        $updater->saveRevision( CommentStoreComment::newUnsavedComment(
            'Converting interactive map to Extension:DataMaps format' ), 0 );
        $status = $updater->getStatus();

        if ( $status->isOK() ) {
            $this->output( "    done\n" );
        } else {
            $this->output( "    failed to save\n" );
            $this->output( $status->getWikiText() . "\n" );
        }
    }

    private const UNSUPPORTED_PROPS = [
        'defaultSort', 'pageCategories', 'useMarkerClustering'
    ];
    private const UNSUPPORTED_CATEGORY_PROPS = [
        'symbol', 'symbolColor'
    ];

    private function convertObject( $fmData ) {
        foreach ( self::UNSUPPORTED_PROPS as $propName ) {
            if ( isset( $fmData->$propName ) && !empty( $fmData->$propName ) ) {
                $this->output( "    ... unsupported property: $propName\n" );
            }
        }

        // Create a new object that will contain the output
        $dmData = new stdclass();
        // Set schema
        $schemaProvider = MediaWikiServices::getInstance()->getService( SchemaProvider::SERVICE_NAME );
        $dmData->{'$schema'} = $schemaProvider->makePublicUrl( 'v17' );
        // Retrieve coordinate system information
        $coordOrder = $fmData->coordinateOrder;
        $coordSpace = $fmData->mapBounds;
        $coordOrigin = $fmData->origin;
        // Take out upper bound for easier access
        $fmMaxX = $coordSpace[1][0];
        $fmMaxY = $coordSpace[0][1];
        // Determine if coordinates have to be swapped places
        $isSourceXY = $coordOrder == 'xy';
        // Handle bounds translation by origin
        switch ( $coordOrigin ) {
            case 'bottom-left':
                // Swap bounds order to be compliant with DataMaps' spec for the CRS property
                $coordSpace = [ $coordSpace[1], $coordSpace[0] ];
                break;
            case 'top-left':
                break;
            default:
                $this->output( "    ... unknown origin, coordinates may be misplaced: $coordOrigin\n" );
        }
        // Set up the CRS segment
        $dmData->crs = new stdClass();
        if ( $isSourceXY ) {
            $dmData->crs->order = 'xy';
        }
        $dmData->crs->topLeft = $coordSpace[0];
        $dmData->crs->bottomRight = $coordSpace[1];
        // Migrate the background
        if ( !$this->ensureImageExists( $fmData->mapImage ) ) {
            return null;
        }
        $dmData->image = $fmData->mapImage;

        // Create group and marker lists ahead of time to simplify initialisation
        $dmData->groups = new stdclass();
        $dmData->markers = new stdclass();

        // Convert categories into groups
        $categoryMap = [];
        foreach ( $fmData->categories as $fmCategoryData ) {
            $fmCategoryName = $fmCategoryData->name;
            // Spaces are not supported in DataMaps' group names as there's no way to differentiate it from layers
            $dmGroupName = str_replace( ' ', '', $fmCategoryName );
            // Memorise the category ID so markers can be mapped later
            $categoryMap[$fmCategoryData->id] = $dmGroupName;
            // Create a new object that will house the group
            $dmGroupData = new stdclass();
            $dmData->groups->$dmGroupName = $dmGroupData;
            // Initialise the marker list
            $dmData->markers->$dmGroupName = [];
            // Check for unsupported properties
            foreach ( self::UNSUPPORTED_CATEGORY_PROPS as $propName ) {
                if ( isset( $fmCategoryData->$propName ) && !empty( $fmCategoryData->$propName ) ) {
                    $this->output( "    ... unsupported property in category '$fmCategoryName', this must be solved manually on "
                        . "site: $propName\n" );
                }
            }
            // Map name
            $dmGroupData->name = $fmCategoryData->name;
            // Map icon and colour
            if ( isset( $fmCategoryData->icon ) && !empty( $fmCategoryData->icon ) ) {
                if ( !$this->ensureImageExists( $fmCategoryData->icon ) ) {
                    return null;
                }
                $dmGroupData->icon = $fmCategoryData->icon;
                $dmGroupData->size = 30;
            } else {
                $dmGroupData->pinColor = $fmCategoryData->color;
                $dmGroupData->size = 30;
            }
        }

        // Convert markers
        foreach ( $fmData->markers as $fmMarkerData ) {
            // Get group name
            $dmGroupName = $categoryMap[$fmMarkerData->categoryId];
            // Create a new object that will house the marker
            $dmMarkerData = new stdclass();
            $dmData->markers->$dmGroupName[] = $dmMarkerData;
            // Map ID if given
            if ( isset( $fmMarkerData->id ) && !empty( $fmMarkerData->id ) ) {
                $dmMarkerData->id = $fmMarkerData->id;
            }
            // Map coordinates
            $coords = $fmMarkerData->position;
            $coords[0] = round( $coords[0], 3 );
            $coords[1] = round( $coords[1], 3 );
            if ( $isSourceXY ) {
                $dmMarkerData->x = $coords[0];
                $dmMarkerData->y = $coords[1];
            } else {
                $dmMarkerData->y = $coords[0];
                $dmMarkerData->x = $coords[1];
            }
            // Map popup settings
            $fmPopupData = $fmMarkerData->popup;
            $dmMarkerData->name = $fmPopupData->title;
            if ( isset( $fmPopupData->description ) && !empty( $fmPopupData->description ) ) {
                $dmMarkerData->description = $fmPopupData->description;
            }
            if ( isset( $fmPopupData->link ) && isset( $fmPopupData->link->url ) && !empty( $fmPopupData->link->url ) ) {
                $dmMarkerData->article = $fmPopupData->link->url;
            }
            if ( isset( $fmPopupData->image ) && !empty( $fmPopupData->image ) ) {
                if ( !$this->ensureImageExists( $fmPopupData->image ) ) {
                    return null;
                }
                $dmMarkerData->image = $fmPopupData->image;
            }
        }

        // De-duplicate the article property for markers (set it on group instead)
        foreach ( $dmData->markers as $dmGroupName => $dmMarkers ) {
            $dmGroupData = $dmData->groups->$dmGroupName;
            // Check if all markers have an article, and if all are the same
            $allTheSame = true;
            $lastValue = null;
            foreach ( $dmMarkers as $dmMarker ) {
                if ( !isset( $dmMarker->article ) ) {
                    $allTheSame = false;
                    break;
                }

                if ( $lastValue != null && $dmMarker->article == $lastValue ) {
                    $allTheSame = true;
                }
                $lastValue = $dmMarker->article;
            }
            // If that is the case, remove the property from every marker and set it on the group instead
            if ( $allTheSame ) {
                if ( !empty( trim( $lastValue ) ) ) {
                    $dmGroupData->article = $lastValue;
                }
                foreach ( $dmMarkers as $dmMarker ) {
                    unset( $dmMarker->article );
                }
            }
        }

        return $dmData;
    }

    private const EXTENSIONS_TO_GUESS = [ '.jpg', '.png', '.svg', '.jpeg' ];

    private function ensureImageExists( string &$name ): bool {
        if ( !str_contains( $name, '.' ) ) {
            $this->output( "    ... missing file extension, guessing: $name\n" );
            foreach ( self::EXTENSIONS_TO_GUESS as $ext ) {
                $file = DataMapFileUtils::getFile( str_replace( '/', '_', $name ) . $ext );
                if ( $file && $file->exists() ) {
                    $name = $name . $ext;
                    break;
                }
            }
        }

        $file = DataMapFileUtils::getFile( $name );
        if ( !$file || !$file->exists() ) {
            $this->output( "    ... image is missing, upload it first: $name\n" );
            return false;
        }
        return true;
    }
}

$maintClass = ConvertMaps::class;
require_once RUN_MAINTENANCE_IF_MAIN;
