const Leaflet = require( '../vendor/leaflet/leaflet.js' );
module.exports = Object.assign( {}, Leaflet, {
    Ark: {
        Popup: require( './Popup.js' ),
        PinIcon: require( './PinIcon.js' ),
        /**
         * @since 0.16.3
         */
        KeybindInteractionControl: require( './KeybindInteraction.js' ),
        /**
         * @since 0.16.3
         */
        SleepInteractionControl: require( './SleepInteraction.js' ),
        /**
         * @since 0.17.11
         */
        BottomLeftPixelCrs: Leaflet.Util.extend( {}, Leaflet.CRS.Simple, {
            transformation: new Leaflet.Transformation( 1, 0, -1, 0 )
        } ),
        /**
         * @since 0.17.11
         */
        TopLeftPixelCrs: Leaflet.Util.extend( {}, Leaflet.CRS.Simple, {
            transformation: new Leaflet.Transformation( 1, 0, 1, 0 )
        } ),
        /**
         * @since 0.17.11
         */
        TileManager: require( './TileManager.js' )
    }
} );
