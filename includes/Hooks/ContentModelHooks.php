<?php
namespace MediaWiki\Extension\DataMaps\Hooks;

use MediaWiki\Extension\DataMaps\ExtensionConfig;
use MediaWiki\Extension\DataMaps\Migration\Fandom\FandomMapContentHandler;
use MediaWiki\Title\Title;

// @phpcs:disable MediaWiki.NamingConventions.LowerCamelFunctionsName.FunctionName

final class ContentModelHooks implements
    \MediaWiki\Revision\Hook\ContentHandlerDefaultModelForHook
{
    public function __construct(
        private readonly ExtensionConfig $config
    ) { }

    public static function onRegistration(): bool {
        define( 'CONTENT_MODEL_DATAMAPS', 'datamap' );
        define( 'CONTENT_MODEL_DATAMAPS_FANDOM_COMPAT', 'interactivemap' );

        global $wgContentHandlers, $wgDataMapsNamespaceId, $wgDataMapsAllowExperimentalFeatures, $wgDataMapsEnableFandomPortingTools;
        if ( $wgDataMapsAllowExperimentalFeatures && $wgDataMapsEnableFandomPortingTools && $wgDataMapsNamespaceId === 2900 ) {
            $wgContentHandlers[CONTENT_MODEL_DATAMAPS_FANDOM_COMPAT] = FandomMapContentHandler::class;
        }

        return true;
    }

    private static function isDocPage( Title $title ) {
        $docPage = wfMessage( 'datamap-doc-page-suffix' )->inContentLanguage();
        return !$docPage->isDisabled() && str_ends_with( $title->getPrefixedText(), $docPage->plain() );
    }

    /**
     * Promotes map content model as default for pages in the Map namespace, optionally checking if the title prefix is
     * satisfied.
     *
     * @param Title $title
     * @param string &$model
     * @return void
     */
    public function onContentHandlerDefaultModelFor( $title, &$model ) {
        if ( $title->getNamespace() === $this->config->getNamespaceId() && !self::isDocPage( $title ) ) {
            $prefix = wfMessage( 'datamap-standard-title-prefix' )->inContentLanguage();
            if ( $prefix !== '-' && str_starts_with( $title->getText(), $prefix->plain() ) ) {
                $model = CONTENT_MODEL_DATAMAPS;
            }
        }
    }

    /**
     * Informs Extension:CodeEditor that map pages should use JSON highlighting.
     *
     * @param Title $title
     * @param string &$languageCode
     * @return bool
     */
    public function onCodeEditorGetPageLanguage( Title $title, &$languageCode ) {
        if ( $this->config->shouldUseCodeEditor() && $title->hasContentModel( CONTENT_MODEL_DATAMAPS ) ) {
            $languageCode = 'json';
            return false;
        }

        return true;
    }

    /**
     * Informs Extension:CodeMirror that map pages should use JSON highlighting.
     */
    public function onCodeMirrorGetMode( Title $title, ?string &$mode, string $model ): bool {
        if ( $this->config->shouldUseCodeMirror() && $title->hasContentModel( CONTENT_MODEL_DATAMAPS ) ) {
            $mode = 'json';
            return false;
        }

        return true;
    }
}
