const CoordinateSystemNew = require('./CoordinateSystemNew.js');
const
    MapStorage = require( './MapStorage.js' ),
    { MapFlags, MarkerGroupFlags, PresentationFlags } = require( './enums.js' ),
    MarkerLayerManager = require( './MarkerLayerManager.js' ),
    MarkerPopup = require( './MarkerPopup.js' ),
    MarkerStreamingManager = require( './MarkerStreamingManager.js' ),
    MarkerFactory = require( './MarkerFactory.js' ),
    CoordinateSystem = require( './CoordinateSystem.js' ),
    Viewport = require( './Viewport.js' ),
    Background = require( './Background.js' ),
    LegendTabber = require( './legend/LegendTabber.js' ),
    MarkerFilteringPanel = require( './legend/MarkerFilteringPanel.js' ),
    EventEmitter = require( './EventEmitter.js' ),
    CollectiblesPanel = require( './legend/CollectiblesPanel.js' ),
    Util = require( './Util.js' );
/** @type {!LeafletModule} */
// @ts-ignore: Lazily initialised, this'd be ideally solved with post-fix assertions but we're in JS land.
let Leaflet = null;


/**
 * A class that initialises, manages and represents a data map.
 *
 * @extends EventEmitter<DataMaps.EventHandling.MapListenerSignatures>
 */
class DataMap extends EventEmitter {
    /**
     * @param {number} id
     * @param {HTMLElement} rootElement
     * @param {DataMaps.Configuration.Map} config
     * @param {Record<string, any>} embedConfig
     */
    constructor( id, rootElement, config, embedConfig ) {
        super();

        /**
         * Page ID of the map source data.
         *
         * @type {number}
         */
        this.id = id;
        /**
         * Root DOM element of the data map.
         *
         * @type {HTMLElement}
         */
        this.rootElement = rootElement;
        /**
         * @private
         * @type {boolean}
         */
        this._isMiniLayout = rootElement.classList.contains( 'ext-datamaps-mini-layout' );
        /**
         * Setup configuration.
         *
         * @deprecated since 0.16.5; will be removed in 0.20.0. Alternatives will be made over the v0.17 cycle.
         * @type {DataMaps.Configuration.Map}
         */
        this.config = config;
        /**
         * @type {Record<string, any>}
         */
        this._embedConfig = embedConfig;
        /**
         * Feature flag bitmask.
         *
         * @private
         * @type {number}
         */
        this._flags = config.flags | ( this._embedConfig.presentationFlags || 0 );
        /**
         * Coordinate system specification.
         * @type {CoordinateSystem}
         */
        this.crs = this.checkFeatureFlag( MapFlags.Coordinates3 )
            ? new CoordinateSystemNew( config.cOrigin, config.cOrder, config.cRot )
            : new CoordinateSystem( config.crs, config.cOrder, config.cRot );
        /**
         * Local map storage interface.
         *
         * @type {MapStorage}
         */
        this.storage = new MapStorage( this );
        /**
         * Global map storage interface.
         *
         * @type {MapStorage}
         */
        this.globalStorage = new MapStorage( this, 'global' );
        /**
         * Layer visibility manager.
         *
         * @type {MarkerLayerManager}
         */
        this.layerManager = new MarkerLayerManager( this );
        /**
         * @type {MarkerFactory}
         */
        this.markerFactory = new MarkerFactory( this );
        /**
         * Marker data streaming controller.
         *
         * @type {MarkerStreamingManager}
         */
        this.streaming = new MarkerStreamingManager( this );
        /**
         * Backgrounds.
         *
         * @type {Background[]}
         */
        this.backgrounds = config.backgrounds.map( ( el, index ) => new Background( this, el, index ) );
        /**
         * Current background index.
         *
         * @type {number}
         */
        this._currentBackgroundIndex = 0;
        /**
         * Data set filters.
         *
         * @type {string[]?}
         */
        this.dataSetFilters = this.rootElement.dataset.filterGroups ? this.rootElement.dataset.filterGroups.split( '|' ) : null;
        /**
         * DOM element to display any status messages.
         *
         * @type {HTMLElement}
         */
        this.statusElement = /** @type {HTMLElement} */ ( Util.getNonNull( rootElement.querySelector(
            '.ext-datamaps-container-status' ) ) );
        /**
         * Instance of the tab manager in the legend. Only initialised when legend is done loading, if it's enabled.
         *
         * @type {LegendTabber?}
         */
        this.legend = null;
        /**
         * Viewport instance. This is lazy-loaded.
         *
         * @type {Viewport?}
         */
        this.viewport = null;
        /**
         * Collection of Leaflet.Icons by group.
         *
         * @private
         * @type {Record<string, LeafletModule.Icon>}
         */
        this._iconCache = {};
        /**
         * Content bounds cache.
         *
         * @type {LeafletModule.LatLngBounds?}
         */
        this._contentBounds = null;
        /**
         * @type {HTMLElement?}
         */
        this._fullScreenAnchor = null;

        this._setUpUriMarkerHandler();

        // Force the IconRenderer_Canvas flag if dmfullcanvas in the URL
        if ( Util.getQueryParameter( 'dmfullcanvas' ) ) {
            this._flags = this._flags | MapFlags.IconRenderer_Canvas;
        }

        // Restore background selection to sync up state
        this.setBackground( this.storage.data.background || 0 );

        // Register groups from the configuration with the layer visibility manager, and set their default state
        for ( const groupName in this.config.groups ) {
            const group = this.config.groups[ groupName ];

            // Register with the layer manager
            this.layerManager.register( groupName );

            if ( Util.isBitSet( group.flags, MarkerGroupFlags.IsUnselected ) ) {
                this.layerManager.setExclusion( groupName, true );
            }
        }

        // Proxy MarkerFactory events on this class for backwards compatibility (v0.17.10)
        this.markerFactory.createEventProxyOn( 'modifyMarkerOptions', this );
        this.markerFactory.createEventProxyOn( 'markerReady', this );
        // Set up internal event handlers
        this.on( 'linkedEvent', this._onLinkedEventReceived, this );
        this.on( 'legendManager', this._initialiseFiltersPanel, this );
        if ( !this.checkFeatureFlag( MapFlags.VisualEditor ) && Object.values( this.config.groups ).some( x =>
            Util.Groups.getCollectibleType( x ) ) ) {
            this.on( 'legendManager', this._initialiseCollectiblesPanel, this );
        }

        // Prepare the Leaflet map view
        mw.loader.using( 'ext.datamaps.leaflet', () => {
            if ( Leaflet === null ) {
                Leaflet = Util.getLeaflet();
            }
            this._setupViewport();
        } );

        // Request OOUI to be loaded and build the legend
        if ( !( !this.checkFeatureFlag( MapFlags.VisualEditor ) && this.checkFeatureFlag( MapFlags.HideLegend ) ) ) {
            mw.loader.using( [
                'oojs-ui-core',
                'oojs-ui-widgets'
            ], () => this.on( 'leafletLoaded', this._onOOUILoaded, this ) );
        }

        // TODO: in GH#165, fire this after API returns the config
        if ( this.config.custom ) {
            this.fireMemorised( 'customData', this.config.custom );
        }
    }


    /**
     * @private
     * @fires DataMap#leafletLoaded
     * @fires DataMap#leafletLoadedLate
     */
    _setupViewport() {
        this.viewport = new Viewport( this, this.config );

        // Notify other components that the Leaflet component has been loaded, and remove all subscribers. All future
        // subscribers will be invoked right away.
        this.fireMemorised( 'leafletLoaded' );
        this.fireMemorised( 'leafletLoadedLate' );
    }


    /**
     * Calls deactivation events and removes this map from the DOM. After this is called, this map should no longer be interacted
     * with by scripts.
     */
    destroy() {
        this.fire( 'deactivate' );
        this.rootElement.remove();
    }


    /**
     * Checks if all bits of a mask are set on the configured flags constant.
     *
     * @param {number} mask Features bit mask.
     * @return {boolean}
     */
    checkFeatureFlag( mask ) {
        return Util.isBitSet( this._flags, mask );
    }


    /**
     * @param {null|'info'|'error'} severity
     * @param {string} [html]
     * @param {boolean} [showProgressBar]
     */
    setStatusOverlay( severity, html, showProgressBar ) {
        this.statusElement.dataset.severity = severity || 'info';
        this.statusElement.style.display = severity ? 'block' : 'none';
        if ( html ) {
            this.statusElement.children[ 1 ].innerHTML = html;
        }
        if ( showProgressBar !== undefined ) {
            /** @type {HTMLElement} */ ( this.statusElement.children[ 0 ] ).style.display = showProgressBar ? 'block' : 'none';
        }
    }


    /**
     * @return {boolean}
     */
    canModifyUriAddress() {
        return !this._isMiniLayout;
    }


    /**
     * @private
     */
    _setUpUriMarkerHandler() {
        const focusedId = this._embedConfig.focusedMarker || this.rootElement.getAttribute( 'data-focused-marker' );
        const idToOpen = focusedId || Util.getQueryParameter( 'marker' );
        if ( !idToOpen ) {
            return;
        }

        // If in a tabber and TabberNeue is not loaded yet, wait for it. We can't efficiently make any guarantees about
        // the ID until then.
        const tabberId = Util.TabberNeue.getOwningId( this.rootElement );
        if ( tabberId !== null && mw.loader.getState( Util.TabberNeue.module ) !== 'ready' ) {
            mw.loader.using( Util.TabberNeue.module, () => this._setUpUriMarkerHandler() );
            return;
        }

        // If in a tabber, check if the hash location matches
        if ( tabberId && tabberId !== window.location.hash.slice( 1 ) ) {
            return;
        }

        // Listen to incoming markers and wait for a matching one
        const handler = /** @type {DataMaps.EventHandling.MapListenerSignatures['markerReady']} */ ( leafletMarker => {
            const mId = Util.getMarkerId( leafletMarker );
            // Check both exact match and match with an `M` prefix for legacy pre-v0.16 link support
            if ( mId === idToOpen || `M${mId}` === idToOpen ) {
                this.navigateToMarker( leafletMarker, {
                    centreOver: true,
                    skipAnimations: true,
                    openPopup: focusedId ? !this.checkFeatureFlag( PresentationFlags.CentreOverFocusedMarker ) : true
                } );
                this.off( 'markerReady', handler, this );
            }
        } );
        this.on( 'markerReady', handler, this );
    }


    /**
     * Returns true if a layer is used on the map. This is a look-up on the static configuration provided by the server, and does
     * not depend on any data being loaded.
     *
     * @param {string} name Name of the layer to check.
     * @return {boolean} Whether a layer is used.
     */
    isLayerUsed( name ) {
        return this.config.layerIds.indexOf( name ) >= 0;
    }


    /**
     * @param {string} name Name of the layer to check.
     * @return {boolean}
     */
    isLayerFilteredOut( name ) {
        return this.dataSetFilters && this.dataSetFilters.indexOf( name ) < 0 || false;
    }


    /**
     * @param {boolean} value 
     */
    setFullScreen( value ) {
        if ( value && this._fullScreenAnchor === null ) {
            // Turn fullscreen on
            this._fullScreenAnchor = Util.createDomElement( 'div', {
                classes: [ 'ext-datamaps-map-anchor' ]
            } );
            Util.getNonNull( this.rootElement.parentNode ).insertBefore( this._fullScreenAnchor, this.rootElement );
            this.rootElement.classList.add( 'ext-datamaps-is-fullscreen' );
            document.body.appendChild( this.rootElement );
            this.fire( 'fullscreenSwitched', true );
        } else if ( !value && this._fullScreenAnchor ) {
            // Turn fullscreen off
            Util.getNonNull( this._fullScreenAnchor.parentNode ).replaceChild( this.rootElement, this._fullScreenAnchor );
            this.rootElement.classList.remove( 'ext-datamaps-is-fullscreen' );
            this._fullScreenAnchor = null;
            this.fire( 'fullscreenSwitched', false );
        }
    }


    /**
     * @return {boolean}
     */
    isFullScreen() {
        return this._fullScreenAnchor !== null;
    }


    /**
     * Returns global storage interface for global collectibles, local otherwise.
     *
     * @param {DataMaps.Configuration.MarkerGroup} group
     * @return {MapStorage}
     */
    getStorageForMarkerGroup( group ) {
        return Util.isBitSet( group.flags, MarkerGroupFlags.Collectible_GlobalGroup ) ? this.globalStorage : this.storage;
    }


    /**
     * Handles a event sent by another data map on this page. This is used for cross-communication. Sender map is exposed under
     * `event.map`.
     *
     * Message delivery is handled by the bootstrap itself, and not maps.
     *
     * @protected
     * @param {DataMaps.EventHandling.Linked.Event} event External event information.
     */
    _onLinkedEventReceived( event ) {
        switch ( event.type ) {
            // Sent when a global group's collected status changes. Data contains affected `groupId` and `state` after
            // changed.
            case 'groupDismissChange': {
                const gdeEvent = /** @type {DataMaps.EventHandling.Linked.IGroupDismissChangeEvent} */ ( event );
                const group = this.config.groups[ gdeEvent.groupId ];
                if ( group && Util.isBitSet( group.flags, MarkerGroupFlags.Collectible_GlobalGroup ) ) {
                    this._updateGlobalDismissal( gdeEvent.groupId, gdeEvent.state );
                }
                break;
            }
        }
    }


    /**
     * For a group, updates each marker's dismissal state and notifies other components (such as checklists). This may be called
     * either by natural/direct user interaction or a linked event.
     *
     * @protected
     * @param {string} groupId Identifier of a group to update.
     * @param {boolean} state Whether dismissed.
     * @fires DataMap#markerDismissChange For each updated marker.
     * @fires DataMap#groupDismissChange For the group.
     */
    _updateGlobalDismissal( groupId, state ) {
        for ( const leafletMarker of this.layerManager.byLayer[ groupId ] ) {
            leafletMarker.setDismissed( state );
            this.fire( 'markerDismissChange', leafletMarker );
        }
        this.fire( 'groupDismissChange', groupId );
    }


    /**
     * Switches marker's (or its group's) collected status in storage, updates visuals, and notifies other components. In case of
     * global collectibles also fires a linked event to notify other maps on the page.
     *
     * @param {LeafletModule.AnyMarker} leafletMarker
     * @fires DataMap#markerDismissChange For the marker if it's an individual collectible.
     * @fires DataMap#sendLinkedEvent (groupDismissChange) When a group has its status updated instead.
     * @return {boolean} New state.
     */
    toggleMarkerDismissal( leafletMarker ) {
        const groupId = leafletMarker.attachedLayers[ 0 ],
            mode = Util.Groups.getCollectibleType( this.config.groups[ groupId ] ),
            isIndividual = mode === MarkerGroupFlags.Collectible_Individual,
            storage = this.getStorageForMarkerGroup( this.config.groups[ groupId ] ),
            state = storage.toggleDismissal( isIndividual ? Util.getMarkerId( leafletMarker ) : groupId, !isIndividual );
        if ( isIndividual ) {
            // Update this marker only
            leafletMarker.setDismissed( state );
            this.fire( 'markerDismissChange', leafletMarker );
        } else {
            this._updateGlobalDismissal( groupId, state );
            // If global, broadcast an event to other maps on this page
            if ( mode === MarkerGroupFlags.Collectible_GlobalGroup ) {
                this.fire( 'sendLinkedEvent', {
                    type: 'groupDismissChange',
                    groupId,
                    state
                } );
            }
        }
        return state;
    }


    /**
     * Returns a Leaflet icon object for marker layers. All access is cached.
     *
     * Group icon is used if there is no layer overriding it. However, if there is one, first such layer is used and rest are
     * discarded.
     *
     * @param {string[]} layers
     * @return {LeafletModule.Icon}
     */
    getIconFromLayers( layers ) {
        const markerType = layers.join( ' ' );
        // Construct the object if not found in cache
        if ( !this._iconCache[ markerType ] ) {
            const group = /** @type {DataMaps.Configuration.IconBasedMarkerGroup} */ ( this.config.groups[ layers[ 0 ] ] );

            if ( 'pinColor' in group ) {
                this._iconCache[ markerType ] = new Leaflet.Ark.PinIcon( {
                    colour: group.pinColor,
                    strokeColour: group.strokeColor || '#fffa',
                    strokeWidth: group.strokeWidth || 0.5,
                    iconSize: group.size,
                    // Pin markers are currently not supported by canvas renderer
                    useWithCanvas: false
                } );
            } else if ( 'markerIcon' in group ) {
                // Look for the first layer of this marker that has an icon override property
                let markerIcon = group.markerIcon;
                const override = layers.find( x => this.config.layers[ x ] && this.config.layers[ x ].markerIcon );
                if ( override ) {
                    markerIcon = Util.getNonNull( this.config.layers[ override ].markerIcon );
                }

                this._iconCache[ markerType ] = new Leaflet.Icon( {
                    iconUrl: markerIcon,
                    iconSize: group.size,
                    useWithCanvas: this.shouldRenderIconsOnCanvas()
                } );
            }
        }
        return this._iconCache[ markerType ];
    }


    /**
     * Returns the class to be used for marker popup contents.
     *
     * @return {typeof MarkerPopup}
     */
    getPopupClass() {
        return MarkerPopup;
    }


    /**
     * Returns whether icon markers may be rendered onto a canvas.
     *
     * @return {boolean}
     */
    shouldRenderIconsOnCanvas() {
        return this.checkFeatureFlag( MapFlags.IconRenderer_Canvas );
    }


    /**
     * Creates a Leaflet marker instance from information provided by the API: layers, and an array with latitude, longitude, and
     * optional data (the "state").
     *
     * Produces a `markerReady(Marker)` event. This event should be used sparingly whenever there's a possibility for a hot-path.
     *
     * @param {string[]} layers
     * @param {DataMaps.UncheckedApiMarkerInstance} uncheckedInstance
     * @param {DataMaps.RuntimeMarkerProperties?} [properties]
     * @fires DataMap#modifyMarkerOptions
     * @fires DataMap#markerReady
     * @return {LeafletModule.AnyMarker} A Leaflet marker instance.
     */
    createMarkerFromApiInstance( layers, uncheckedInstance, properties ) {
        return this.markerFactory.DEPRECATED_createMarkerFromApiInstance( layers, uncheckedInstance, properties );
    }


    /**
     * Creates a Leaflet marker instance with given layers, position and API state object.
     *
     * @param {string[]} layers Array of string layer names.
     * @param {LeafletModule.PointTuple} position Point to place the marker at.
     * @param {DataMaps.IApiMarkerSlots?} [state] Optional object with fields: label, desc, image, article, search.
     * @param {DataMaps.RuntimeMarkerProperties?} [properties] Optional object with arbitrary fields.
     * @return {LeafletModule.AnyMarker} Leaflet marker instance.
     */
    createMarker( layers, position, state, properties ) {
        return this.markerFactory.DEPRECATED_createMarker( layers, position, state, properties );
    }


    /**
     * Opens a marker's popup, while respecting its background ties.
     *
     * @deprecated since v0.17.5, to be removed in v0.18.0. Use navigateToMarker.
     * @param {LeafletModule.AnyMarker} leafletMarker
     * @param {boolean} [centreMapOver=false]
     * @param {boolean} [centreMapOverInstantly=false]
     * @param {boolean} [noPopup=false]
     */
    openMarkerPopup( leafletMarker, centreMapOver, centreMapOverInstantly, noPopup ) {
        this.navigateToMarker( leafletMarker, {
            centreOver: centreMapOver,
            skipAnimations: centreMapOverInstantly,
            openPopup: !noPopup
        } );
    }


    /**
     * Opens a marker's popup, while respecting its background ties.
     *
     * @param {LeafletModule.AnyMarker} leafletMarker
     * @param {Object} params
     * @param {boolean} [params.centreOver=false]
     * @param {boolean} [params.skipAnimations=false]
     * @param {boolean} [params.openPopup=true]
     */
    navigateToMarker( leafletMarker, {
        centreOver = false,
        skipAnimations = false,
        openPopup = true
    } ) {
        const properties = leafletMarker.assignedProperties;
        if ( properties && properties.bg !== undefined ) {
            const backgroundIndex = this.config.backgrounds.findIndex( x => x.layer === properties.bg );
            if ( backgroundIndex >= -1 ) {
                this.setBackground( backgroundIndex );
            }
        }

        if ( openPopup ) {
            leafletMarker.openPopup();
        }

        const viewport = Util.getNonNull( this.viewport );
        if ( centreOver && viewport.getLeafletMap().options.uriPopupZoom !== false ) {
            viewport.flyToMarker( leafletMarker, skipAnimations );
        }
    }


    /**
     * Changes currently shown background without affecting the user preference.
     *
     * @since 0.17.0
     * @param {number} index
     * @fires DataMap#backgroundChange
     */
    setBackground( index ) {
        // Check if index is valid, and fall back to first otherwise
        if ( index < 0 || index >= this.backgrounds.length ) {
            index = 0;
        }

        const target = this.backgrounds[ index ];
        this._currentBackgroundIndex = index;

        // Hide any unmatching "bg" sub-layer
        this.layerManager.setOptionalPropertyRequirement( 'bg', target.categoryId );

        this.fire( 'backgroundChange', index, target );
    }


    /**
     * @since 0.17.0
     * @return {number}
     */
    getCurrentBackgroundIndex() {
        return this._currentBackgroundIndex;
    }


    /**
     * Changes currently shown background and updates user preferences.
     *
     * @param {number} index
     */
    setBackgroundPreference( index ) {
        this.setBackground( index );
        // Remember the choice
        this.storage.data.background = index;
        this.storage.commit();
    }


    /**
     * Calculates content bounds at a given moment from all of the map's contents (all geometrical layers are included). This is
     * uncached and fairly expensive.
     *
     * @param {boolean} [invalidate] Whether the bounds should be recalculated.
     * @return {LeafletModule.LatLngBounds}
     */
    getCurrentContentBounds( invalidate ) {
        if ( this.viewport === null ) {
            throw new Error( 'Viewport-dependent method called but viewport not ready: getCurrentContentBounds' );
        }

        if ( invalidate || this._contentBounds === null ) {
            const leaflet = this.viewport.getLeafletMap();

            this._contentBounds = new Leaflet.LatLngBounds();
            // Leaflet does not initialise the corners in advance. If there are no layers on the map, this can cause
            // a null dereference. Force initialisation to prevent that.
            this._contentBounds.extend( [ 0, 0 ] );
            // Extend with each layer's bounds
            for ( const id in leaflet._layers ) {
                const layer = leaflet._layers[ id ];

                if ( 'getBounds' in layer ) {
                    let layerBounds = /** @type {LeafletModule.IHasBoundsGetter} */ ( layer ).getBounds();
                    // Fairly infrequent code... unless a wiki shows up with lots of vector overlays. No need to inline
                    // coordinate transformations until then.
                    if ( this.crs.rotation ) {
                        for ( const [ a, b ] of [
                            [ layerBounds._southWest, layerBounds._northEast ],
                            [ layerBounds.getSouthEast(), layerBounds.getNorthWest() ]
                        ] ) {
                            layerBounds = new Leaflet.LatLngBounds( this.crs.fromBox( [
                                [ a.lat, a.lng ],
                                [ b.lat, b.lng ]
                            ] ) );
                        }
                    }
                    this._contentBounds.extend( layerBounds );
                } else if ( layer.getLatLng ) {
                    this._contentBounds.extend( layer.getLatLng() );
                }
            }
        }

        // Copy the cache into a new object
        return new Leaflet.LatLngBounds().extend( this._contentBounds );
    }


    /**
     * @return {number}
     */
    getMapOffsetWidth() {
        const viewportWidth = document.documentElement.clientWidth;
        if (
            this.checkFeatureFlag( MapFlags.HideLegend )
            || this.checkFeatureFlag( MapFlags.CollapseLegend )
            // Check if viewport width is within our frame
            || viewportWidth < DataMap.LEGEND_AFFECTS_BOUNDS_FIT_VIEWPORT_WIDTH[ 0 ]
            || viewportWidth > DataMap.LEGEND_AFFECTS_BOUNDS_FIT_VIEWPORT_WIDTH[ 1 ]
            // Check the groups threshold. Ideally we'd check legend's height here, but it may not have been loaded yet.
            || Object.keys( this.config.groups ).length < DataMap.LEGEND_MINIMUM_GROUPS_TO_OFFSET_VIEWPORT
            // Do not offset if legend is collapsed
            || ( this.legend && !this.legend.isExpanded() )
        ) {
            return 0;
        }
        return Util.getNonNull( this.viewport ).legendAnchor.offsetWidth;
    }


    /**
     * Calculates content bounds and includes extra padding around the area.
     *
     * @param {boolean} invalidate Whether the bounds should be recalculated.
     * @param {number} [bufferMultiplier=1]
     * @return {LeafletModule.LatLngBounds}
     */
    getPaddedContentBounds( invalidate, bufferMultiplier ) {
        bufferMultiplier = bufferMultiplier || 1;
        const bounds = this.getCurrentContentBounds( invalidate ),
            ne = bounds.getNorthEast(),
            sw = bounds.getSouthWest(),
            heightBuffer = Math.abs( sw.lat - ne.lat ) * DataMap.BOUNDS_PADDING[ 0 ] * bufferMultiplier,
            widthBuffer = Math.abs( sw.lng - ne.lng ) * DataMap.BOUNDS_PADDING[ 1 ] * bufferMultiplier;
        bounds.extend( [
            [ sw.lat - heightBuffer, sw.lng - widthBuffer ],
            [ ne.lat + heightBuffer, ne.lng + widthBuffer ]
        ] );
        return bounds;
    }


    /**
     * @private
     * @fires DataMap#legendManager
     */
    _onOOUILoaded() {
        const container = /** @type {HTMLElement} */ ( Util.getNonNull( this.viewport ).legendAnchor );
        this.legend = new LegendTabber( this, container ).setExpanded( !this.checkFeatureFlag( MapFlags.CollapseLegend ) );
        this.fireMemorised( 'legendManager' );
    }


    /**
     * @private
     * @fires markerFilteringPanel
     */
    _initialiseFiltersPanel() {
        // Determine if we'll need a layer dropdown
        const hasCaves = this.isLayerUsed( 'cave' );

        // Initialise legend objects
        this.filtersPanel = new MarkerFilteringPanel( /** @type {LegendTabber} */ ( this.legend ), true ).setVisible( true );

        // Build the surface and caves toggle
        // TODO: this should be gone by v0.15, preferably in v0.14 (though that one's going to be a 1.39 compat update)
        if ( hasCaves ) {
            this.filtersPanel.addMarkerLayerToggleRequired( 'cave', mw.msg( 'datamap-layer-surface' ), false );
            this.filtersPanel.addMarkerLayerToggleExclusive( 'cave', mw.msg( 'datamap-layer-cave' ) );
        }

        // Build individual group toggles
        this.filtersPanel.includeGroups( Object.keys( this.config.groups ) );

        // Notify other components that the legend has been loaded, and remove all subscribers. All future subscribers
        // will be invoked right away.
        this.fireMemorised( 'markerFilteringPanel' );
    }


    /**
     * @private
     * @fires DataMap#collectiblesPanel
     */
    _initialiseCollectiblesPanel() {
        this.collectiblesPanel = new CollectiblesPanel( /** @type {LegendTabber} */ ( this.legend ) ).setVisible( true );
        this.fireMemorised( 'collectiblesPanel' );
    }
}


/**
 * Content bounds padding, relative to run-time computed bounds.
 *
 * @constant
 * @type {LeafletModule.LatLngTuple}
 */
DataMap.BOUNDS_PADDING = [ 1.5, 2 ];
/**
 * Minimum and maximum viewport width for {@link DataMap.restoreDefaultView} to offset new view bounds by legend width.
 *
 * @constant
 * @type {[ min: number, max: number ]}
 */
DataMap.LEGEND_AFFECTS_BOUNDS_FIT_VIEWPORT_WIDTH = [ 1200, 2000 ];
/**
 * @constant
 * @type {number}
 */
DataMap.LEGEND_MINIMUM_GROUPS_TO_OFFSET_VIEWPORT = 5;


module.exports = DataMap;
