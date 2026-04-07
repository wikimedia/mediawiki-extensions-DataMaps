const Leaflet = require( '../vendor/leaflet/leaflet.js' );


module.exports = Leaflet.GridLayer.extend( {
    createTile( coords, doneCallback ) {
        const tile = document.createElement( 'canvas' ),
            imageUrl = this.options.imageLookup( coords );
        // Use physical tile size for the canvas. Leaflet will take care of our positioning.
        tile.width = this.options.physicalWidth;
        tile.height = this.options.physicalHeight;
        tile.setAttribute( 'src', imageUrl );

        if ( imageUrl ) {
            const img = new Image();
            img.addEventListener( 'load', () => {
                tile.getContext( '2d' ).drawImage( img, 0, 0, tile.width, tile.height );
                doneCallback( undefined, tile );
            } );
            img.addEventListener( 'error', event => {
                doneCallback( event, tile );
            } );
            img.src = imageUrl;
        } else {
            // eslint-disable-next-line no-console
            console.warn( `Leaflet wants a tile for undefined position: ${coords}` );
        }

        return tile;
    },


    /**
     * A wiring method needed for content bounds calculations.
     *
     * @return {LeafletModule.LatLngBounds}
     */
    getBounds() {
        return this.options.bounds;
    }
} );
