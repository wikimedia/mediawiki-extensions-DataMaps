/** @typedef {import( './DataMap.js' )} DataMap */
const
    EventEmitter = require( './EventEmitter.js' ),
    Util = require( './Util.js' ),
    { MarkerGroupFlags } = require( './enums.js' ),
    MarkerLayerManager = require( './MarkerLayerManager.js' ),
    MarkerPopup = require( './MarkerPopup.js' );


/**
 * @package Do not use until finalised.
 * @extends EventEmitter<DataMaps.EventHandling.MapListenerSignatures>
 */
class MarkerFactory extends EventEmitter {
    /**
     * @param {DataMap} map
     */
    constructor( map ) {
        super();

        /**
         * Owning map.
         *
         * @type {DataMap}
         */
        this.map = map;
        /**
         * @private
         * @type {Record<string, DataMaps.Configuration.MarkerGroup>}
         */
        this._groups = this.map.config.groups;
        /**
         * @private
         * @type {Record<string, DataMaps.Configuration.MarkerLayer>}
         */
        this._categories = this.map.config.layers;
        /**
         * Layer visibility manager.
         *
         * @private
         * @type {MarkerLayerManager}
         */
        this._layerManager = this.map.layerManager;
        /**
         * Collection of Leaflet.Icons by group.
         *
         * @private
         * @type {Record<string, LeafletModule.Icon>}
         */
        this._iconCache = {};
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
    _getLeafletIconForLayers( layers ) {
        const markerType = layers.join( ' ' );
        // Construct the object if not found in cache
        if ( !this._iconCache[ markerType ] ) {
            const Leaflet = Util.getLeaflet(),
                group = /** @type {DataMaps.Configuration.IconBasedMarkerGroup} */ ( this._groups[ layers[ 0 ] ] );

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
                const override = layers.find( x => this._categories[ x ] && this._categories[ x ].markerIcon );
                if ( override ) {
                    markerIcon = Util.getNonNull( this._categories[ override ].markerIcon );
                }

                this._iconCache[ markerType ] = new Leaflet.Icon( {
                    iconUrl: markerIcon,
                    iconSize: group.size,
                    useWithCanvas: this.map.shouldRenderIconsOnCanvas()
                } );
            }
        }
        return this._iconCache[ markerType ];
    }


    /**
     * Creates a Leaflet marker instance from information provided by the API: layers, and an array with latitude, longitude, and
     * optional data (the "state").
     *
     * Produces a `markerReady(Marker)` event. This event should be used sparingly whenever there's a possibility for a hot-path.
     *
     * @deprecated to be removed without notice when Marker interface rework is complete. Use map methods until then.
     * @param {string[]} layers
     * @param {DataMaps.UncheckedApiMarkerInstance} uncheckedInstance
     * @param {DataMaps.RuntimeMarkerProperties?} [properties]
     * @fires DataMap#modifyMarkerOptions
     * @fires DataMap#markerReady
     * @return {LeafletModule.AnyMarker} A Leaflet marker instance.
     */
    // eslint-disable-next-line camelcase
    DEPRECATED_createMarkerFromApiInstance( layers, uncheckedInstance, properties ) {
        // Initialise state if it's missing, thus reaching a null-safe state
        if ( !uncheckedInstance[ 2 ] ) {
            uncheckedInstance[ 2 ] = {};
        }

        const
            Leaflet = Util.getLeaflet(),
            instance = /** @type {DataMaps.ApiMarkerInstance} */ ( uncheckedInstance ),
            group = this._groups[ layers[ 0 ] ],
            position = this.map.crs.fromPoint( instance ),
            sizeScale = instance[ 2 ].scale,
            useStaticSize = Util.isBitSet( group.flags, MarkerGroupFlags.IsStaticallySized );

        // Construct the marker
        let /** @type {LeafletModule.AnyMarker|undefined} */ leafletMarker;
        if ( 'markerIcon' in group || 'pinColor' in group ) {
            // Fancy icon marker
            const scaledSize = sizeScale
                ? /** @type {LeafletModule.PointTuple} */ ( [ group.size[ 0 ] * sizeScale, group.size[ 1 ] * sizeScale ] )
                : group.size;

            const
                shouldUseCanvas = !( 'pinColor' in group ) && this.map.shouldRenderIconsOnCanvas(),
                Cls = shouldUseCanvas ? Leaflet.CanvasIconMarker : Leaflet.Marker,
                icon = (
                    'markerIcon' in group && instance[ 2 ].icon
                        ? new Leaflet.Icon( {
                            iconUrl: instance[ 2 ].icon,
                            iconSize: scaledSize,
                            useWithCanvas: shouldUseCanvas
                        } )
                        : this._getLeafletIconForLayers( layers )
                ),
                markerOptions = {
                    icon,
                    static: useStaticSize
                };
            this.fire( 'modifyMarkerOptions', Cls, instance, markerOptions );
            leafletMarker = new Cls( position, markerOptions );
        } else {
            // Circular marker
            const
                Cls = ( useStaticSize ? Leaflet.Circle : Leaflet.CircleMarker ),
                markerOptions = {
                    radius: ( sizeScale ? group.size * sizeScale : group.size ) / 2,
                    zoomScaleFactor: group.zoomScaleFactor,
                    fillColor: group.fillColor,
                    fillOpacity: 0.7,
                    color: group.strokeColor || group.fillColor,
                    weight: group.strokeWidth || 1
                };
            this.fire( 'modifyMarkerOptions', Cls, instance, markerOptions );
            leafletMarker = new Cls( position, markerOptions );
        }
        // Persist original coordinates and state
        leafletMarker.apiInstance = instance;
        // Extract properties from the ownership string for quicker access
        if ( properties ) {
            leafletMarker.assignedProperties = properties;
        }
        // Add marker to the layer
        this._layerManager.addMember( layers, leafletMarker );

        // Update dismissal status if storage says it's been dismissed
        const collectibleMode = Util.Groups.getCollectibleType( group );
        if ( collectibleMode ) {
            const isIndividual = collectibleMode === MarkerGroupFlags.Collectible_Individual,
                storage = this.map.getStorageForMarkerGroup( group );
            leafletMarker.setDismissed( storage.isDismissed( isIndividual ? Util.getMarkerId( leafletMarker ) : layers[ 0 ],
                !isIndividual ) );
        }

        // Set up the marker popup
        MarkerPopup.bindTo( this.map, leafletMarker );

        // Fire an event so other components may prepare the marker
        this.fire( 'markerReady', leafletMarker );

        return leafletMarker;
    }


    /**
     * Creates a Leaflet marker instance with given layers, position and API state object.
     *
     * @deprecated to be removed without notice when Marker interface rework is complete. Use map methods until then.
     * @param {string[]} layers Array of string layer names.
     * @param {LeafletModule.PointTuple} position Point to place the marker at.
     * @param {DataMaps.IApiMarkerSlots?} [state] Optional object with fields: label, desc, image, article, search.
     * @param {DataMaps.RuntimeMarkerProperties?} [properties] Optional object with arbitrary fields.
     * @return {LeafletModule.AnyMarker} Leaflet marker instance.
     */
    // eslint-disable-next-line camelcase
    DEPRECATED_createMarker( layers, position, state, properties ) {
        return this.DEPRECATED_createMarkerFromApiInstance( layers, [ position[ 0 ], position[ 1 ], state || null ], properties );
    }
}


module.exports = MarkerFactory;
