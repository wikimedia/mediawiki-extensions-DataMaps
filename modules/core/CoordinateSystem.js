const { CoordinateDisplayStyle, CRSOrigin } = require( './enums.js' ),
    { getLeaflet } = require( './Util.js' );


module.exports = class CoordinateSystem {
    constructor( box, order, angle ) {
        this.topLeft = box[ 0 ];
        this.bottomRight = box[ 1 ];
        this.origin = ( this.topLeft[ 0 ] < this.bottomRight[ 0 ]
            && this.topLeft[ 1 ] < this.bottomRight[ 1 ] ) ? CRSOrigin.TopLeft : CRSOrigin.BottomLeft;
        this.order = order;
        this.rotation = angle;
        this.rSin = Math.sin( -angle );
        this.rCos = Math.cos( -angle );
        this.rSinInv = Math.cos( angle );
        this.rCosInv = Math.cos( angle );
        this.scaleX = 100 / Math.max( this.topLeft[ 0 ], this.bottomRight[ 0 ] );
        this.scaleY = this.scaleX;
    }


    /**
     * Maps a point from map's coordinate reference system specified by the server, to the universal space [ 0 0 100 100 ].
     * This respects CRS rotation.
     *
     * This is non-destructive, and clones the input.
     *
     * @param {DataMaps.PointTupleRepr} point Array with two number elements: X and Y coordinates.
     * @return {LeafletModule.PointTuple} New point in the universal space.
     */
    fromPoint( point ) {
        const
            y = point[ 0 ] * this.scaleY,
            x = point[ 1 ] * this.scaleX;
        return [ x * this.rSin + y * this.rCos, x * this.rCos - y * this.rSin ];
    }


    /**
     * Maps a box from map's coordinate reference system specified by the server, to the universal space [ 0 0 100 100 ].
     * This does not respect CRS rotation. Consumers must handle it on their own.
     *
     * This is non-destructive, and clones the input.
     *
     * @param {LeafletModule.LatLngBoundsTuple} box
     * @return {LeafletModule.LatLngBoundsTuple} New box in the universal space.
     */
    fromBox( box ) {
        const
            sY = box[ 0 ][ 0 ] * this.scaleY,
            sX = box[ 0 ][ 1 ] * this.scaleX,
            eY = box[ 1 ][ 0 ] * this.scaleY,
            eX = box[ 1 ][ 1 ] * this.scaleX;
        return [
            [ sY, sX ],
            [ eY, eX ]
        ];
    }


    /**
     * @param {LeafletModule.LatLng} latlng
     * @param {boolean} [round=false]
     * @return {DataMaps.PointTupleRepr}
     */
    fromLeaflet( latlng, round ) {
        let lat = latlng.lat / this.scaleY,
            lon = latlng.lng / this.scaleX;

        if ( this.rotation ) {
            [ lat, lon ] = [
                lon * this.rSinInv + lat * this.rCosInv,
                lon * this.rCosInv - lat * this.rSinInv
            ];
        }

        if ( round ) {
            lat = Math.round( lat * 10e3 ) / 10e3;
            lon = Math.round( lon * 10e3 ) / 10e3;
        }

        return [ lat, lon ];
    }


    /**
     * Returns a formatted datamap-coordinate-control-text message.
     *
     * @param {DataMaps.PointTupleRepr|number|LeafletModule.LatLng} latOrInstance Latitude or API marker instance
     * @param {number?} [lon] Longitude if no instance specified.
     * @return {string}
     */
    makeLabel( latOrInstance, lon ) {
        let /** @type {number} */ lat;
        if ( Array.isArray( latOrInstance ) ) {
            [ lat, lon ] = latOrInstance;
        } else if ( latOrInstance instanceof getLeaflet().LatLng ) {
            [ lat, lon ] = this.fromLeaflet( latOrInstance );
        } else {
            lat = latOrInstance;
        }

        const message = 'datamap-coordinate-control-text' + (
            this.order === CoordinateDisplayStyle.Xy ? '-xy'
                : this.order === CoordinateDisplayStyle.Yx ? '-yx'
                    : ''
        );
        // Messages that can be used here:
        // * datamap-coordinate-control-text-xy
        // * datamap-coordinate-control-text-yx
        // * datamap-coordinate-control-text
        return mw.msg( message, lat.toFixed( 2 ), /** @type {number} */ ( lon ).toFixed( 2 ) );
    }
};
