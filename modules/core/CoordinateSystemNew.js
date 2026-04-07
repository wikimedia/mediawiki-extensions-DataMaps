const CoordinateSystem = require( './CoordinateSystem.js' );

module.exports = class CoordinateSystemNew extends CoordinateSystem {
    constructor( origin, order, angle ) {
        super( [ [ 0, 0 ], [ 1, 1 ] ], order, angle );
        this.origin = origin;
        this.scaleX = 1;
        this.scaleY = 1;
    }
};
