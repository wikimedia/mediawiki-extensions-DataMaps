/** @typedef {import( './DataMap.js' )} DataMap */
const
    { MapControl } = require( './controls.js' ),
    { getNonNull, getLeaflet } = require( './Util.js' );


class DebugControl extends MapControl {
    /**
     * @param {DataMap} map Owning map.
     */
    constructor( map ) {
        super( map, 'debug' );

        /**
         * @private
         * @type {?LeafletModule.Rectangle}
         */
        this._rect = null;
    }


    _build() {
        this._updateBoundsRect();
        getNonNull( this.map.viewport ).getLeafletMap().on(
            'mousemove zoom',
            this._updateText,
            this
        );
        for ( const event of [
            'backgroundChange',
            'markerVisibilityUpdate',
            'chunkStreamed'
        ] ) {
            this.map.on(
                event,
                this._updateBoundsRect,
                this
            );
        }
    }


    _updateText() {
        const
            viewport = getNonNull( this.map.viewport ),
            leaflet = viewport.getLeafletMap(),
            contentBounds = this.map.getCurrentContentBounds(),
            viewportBounds = leaflet.getBounds();
        this.element.innerHTML = [
            `zoom: [${leaflet.getMinZoom()}; ${leaflet.getMaxZoom()}] ${leaflet.getZoom()}`,
            `content NE: (${contentBounds._northEast.lat}, ${contentBounds._northEast.lng})`,
            `content SW: (${contentBounds._southWest.lat}, ${contentBounds._southWest.lng})`,
            `viewport NE: (${viewportBounds._northEast.lat}, ${viewportBounds._northEast.lng})`,
            `viewport SW: (${viewportBounds._southWest.lat}, ${viewportBounds._southWest.lng})`,
            `offset width: ${this.map.getMapOffsetWidth()}`,
            `popup zoom: ${viewport.getPopupZoom()}`,
            `coordinate scale: (${this.map.crs.scaleX}, ${this.map.crs.scaleY})`,
            `marker scale: v${leaflet.options.vecMarkerScale}, i${leaflet.options.iconMarkerScale}`
        ].join( '<br/>' );
    }


    _updateBoundsRect() {
        if ( !this._rect ) {
            const Leaflet = getLeaflet();
            this._rect = new Leaflet.Rectangle(
                [ [ 0, 0 ], [ 0, 0 ] ],
                {
                    color: '#f0f',
                    weight: 1,
                    dashArray: '8',
                    fill: false
                }
            );
            this._rect.addTo( getNonNull( this.map.viewport ).getLeafletMap() );
        }

        this._rect.setBounds( this.map.getCurrentContentBounds() );
    }
}


module.exports = DebugControl;
