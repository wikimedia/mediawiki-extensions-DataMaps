/* eslint-disable compat/compat */
/** @typedef {import( './DataMap.js' )} DataMap */


/**
 * Requests data from the extension's API
 */
module.exports = class MarkerStreamingManager {
    /**
     * @param {DataMap} map Owning map.
     */
    constructor( map ) {
        this.map = map;
        this.mwApi = new mw.Api();
    }


    /**
     * Retrieves data from the API. Default action is `queryDataMap`.
     *
     * @param {Record<string, string|number>} options
     * @return {JQuery.Promise<Record<string, any>>}
     */
    callApiUnreliable( options ) {
        return this.mwApi.get( $.extend( {
            action: 'queryDataMap',
            uselang: mw.config.get('wgPageContentLanguage'),
        }, options ) ).then(
            data => data.error ? Promise.reject( data.error ) : Promise.resolve( data ),
            reason => Promise.reject( reason )
        );
    }


    /**
     * Retrieves data from the API, retrying a limited number of times until success assuming a single call may fail.
     *
     * @param {Record<string, string|number>} options
     * @param {number?} [retries] Number of re-attempts. Defaults to 3.
     * @param {number?} [waitTime] Wait time between retries, in milliseconds. Doubles on every attempt.
     * @default retries 0
     * @return {Promise<Record<string, any>>}
     */
    callApiReliable( options, retries, waitTime ) {
        const safeRetries = retries || retries === 0 ? retries : 2,
            safeWaitTime = waitTime || 60;
        return new Promise( ( resolve, reject ) => {
            // eslint-disable-next-line no-promise-executor-return
            return this.callApiUnreliable( options )
                .then( resolve )
                .catch( reason => {
                    if ( safeRetries > 0 ) {
                        // eslint-disable-next-line no-promise-executor-return
                        return new Promise( r => setTimeout( r, safeWaitTime ) * 2 )
                            .then( this.callApiReliable.bind( this, options, safeRetries - 1,
                                safeWaitTime * 2 ) )
                            .then( resolve )
                            .catch( reject );
                    }
                    return reject( reason );
                } );
        } );
    }


    /**
     * @param {number?} [pageId]
     * @param {number?} [version]
     * @param {string[]?} [filter]
     * @param {number?} [start]
     * @param {number?} [limit]
     * @param {number?} [sector]
     * @return {Promise<Record<string, any>>}
     */
    requestChunk( pageId, version, filter, start, limit, sector ) {
        pageId = pageId || this.map.id;
        version = version || this.map.config.version;
        filter = filter || this.map.dataSetFilters;

        /** @type {Record<string, string|number>} */
        const query = {
            pageid: pageId
        };
        /* eslint-disable curly */
        if ( version ) query.revid = version;
        if ( filter ) query.layers = filter.join( '|' );
        if ( start !== null && start !== undefined ) query.continue = start;
        if ( limit ) query.limit = limit;
        if ( sector ) query.sector = sector;
        query.cb = this.map.config.lastPurgeTimestamp || 0;
        /* eslint-enable curly */
        return this.callApiReliable( query );
    }


    /**
     * Creates instances of markers from an API response.
     *
     * Properties are extracted from ownership strings, and frozen, as they're shared between all instances within a data set.
     *
     * @param {Record<string, DataMaps.UncheckedApiMarkerInstance[]>} data
     * @fires DataMap#chunkStreamed
     */
    instantiateMarkers( data ) {
        // Register all layers in this package
        for ( const markerType in data ) {
            for ( const name of markerType.split( ' ' ) ) {
                this.map.layerManager.register( name );
            }
        }

        // Unpack markers
        const markers = [];
        for ( const markerType in data ) {
            const layers = markerType.split( ' ' ),
                placements = data[ markerType ];
            /** @type {Record<string, string>?} */
            let properties = null;

            // Extract properties (sub-layers) from the layers
            if ( markerType.indexOf( ':' ) > 0 ) {
                properties = {};
                for ( const layer of layers ) {
                    if ( layer.indexOf( ':' ) > 0 ) {
                        const [ key, value ] = layer.split( ':', 2 );
                        properties[ key ] = value;
                    }
                }
                properties = Object.freeze( properties );
            }

            // Create markers for instances
            for ( const instance of placements ) {
                markers.push( this.map.createMarkerFromApiInstance( layers, instance, properties ) );
            }
        }

        // Notify other components this chunk has been loaded, and send them all produced markers
        this.map.fire( 'chunkStreamed', markers );
    }


    /**
     * @param {number?} [pageId]
     * @param {number?} [version]
     * @param {string[]?} [filter]
     * @param {number?} [start]
     * @param {number?} [limit]
     * @param {number?} [sector]
     * @fires DataMap#chunkStreamingDone
     * @return {Promise<void>}
     */
    loadChunk( pageId, version, filter, start, limit, sector ) {
        return this.requestChunk( pageId, version, filter, start, limit, sector )
            .then( data => {
                this.map.on( 'leafletLoaded', () => {
                    this.instantiateMarkers( data.query.markers );
                    this.map.fireMemorised( 'chunkStreamingDone' );
                } );
            } );
    }


    /**
     * @param {number?} [pageId]
     * @param {number?} [version]
     * @param {string[]?} [filter]
     * @param {number?} [start]
     * @param {number?} [sector]
     * @fires DataMap#chunkStreamingDone
     * @return {Promise<void>}
     */
    loadSequential( pageId, version, filter, start, sector ) {
        return this.requestChunk( pageId, version, filter, start || 0, null, sector )
            .then( data => {
                this.map.on( 'leafletLoaded', () => this.instantiateMarkers( data.query.markers ) );
                if ( data.query.continue ) {
                    return this.loadSequential( pageId, version, filter, data.query.continue );
                } else {
                    // Notify other components that all chunks have been streamed in this request
                    this.map.on( 'leafletLoaded', () => this.map.fireMemorised( 'chunkStreamingDone' ) );
                }
                return;
            } );
    }
};
