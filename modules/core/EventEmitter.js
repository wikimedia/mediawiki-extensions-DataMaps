/**
 * @typedef {Object} EventHandlerRef
 * @property {Object|null|undefined} context
 * @property {Function} method
 */


/**
 * @abstract
 * @template {DataMaps.EventHandling.ListenerSignature} Signatures
 */
module.exports = class EventEmitter {
    constructor() {
        /**
         * @type {Record<string, EventHandlerRef[]>}
         */
        this._handlers = {};
        /** @type {Record<string, any[]>} */
        this._autoFiringEvents = {};
    }


    /**
     * @internal
     * @param {EventHandlerRef} handler Callback descriptor.
     * @param {Array<any>?} args Arguments.
     */
    static invokeHandler( handler, args ) {
        try {
            handler.method.apply( handler.context, args );
        } catch ( error ) {
            // If a listener throws an exception, do not disrupt the emitter's routine, and rethrow the exception later
            setTimeout( () => {
                throw error;
            } );
        }
    }


    /**
     * Registers an event handler.
     *
     * If an event is set to fire immediately with memorised arguments, the handler will be invoked right away and won't
     * be enqueued for the next time.
     *
     * @template {Extract<keyof Signatures, string>} EventId
     * @param {EventId} event
     * @param {Signatures[EventId]} callback
     * @param {any?} [context]
     */
    on( event, callback, context ) {
        const handler = {
            context,
            method: callback
        };
        if ( this._autoFiringEvents[ event ] ) {
            // Event marked to set off right away with persistent parameters, invoke the handler now
            EventEmitter.invokeHandler( handler, this._autoFiringEvents[ event ] );
        } else {
            if ( !this._handlers[ event ] ) {
                this._handlers[ event ] = [];
            }
            // Event requires manual set-off, push the handler onto the list
            this._handlers[ event ].push( handler );
        }
    }


    /**
     * Deregisters all event handlers with the same callback. If no callback function is given, clears ALL handlers for
     * the event.
     *
     * @template {Extract<keyof Signatures, string>} EventId
     * @param {EventId} event
     * @param {Signatures[EventId]?} [callback]
     * @param {any?} [context]
     */
    off( event, callback, context ) {
        // If no callback function given, remove all bound handlers
        if ( !callback ) {
            delete this._handlers[ event ];
            return;
        }

        // If event has any bound handlers, drop those with matching callback function
        if ( this._handlers[ event ] ) {
            this._handlers[ event ] = this._handlers[ event ].filter( x => x.method !== callback && ( !context
                || x.context === context ) );

            // If no handlers left, drop the list entirely
            if ( this._handlers[ event ].length === 0 ) {
                delete this._handlers[ event ];
            }
        }
    }


    /**
     * Invokes all bound event handlers with given arguments.
     *
     * @template {Extract<keyof Signatures, string>} EventId
     * @param {EventId} event
     * @param {Parameters<Signatures[EventId]>} params
     */
    fire( event, ...params ) {
        if ( !this._handlers[ event ] ) {
            return;
        }

        for ( const handler of this._handlers[ event ] ) {
            EventEmitter.invokeHandler( handler, params );
        }
    }


    /**
     * Invokes all bound event handlers and saves given arguments to invoke any future handler right away. All handlers already
     * bound are invoked and dropped.
     *
     * @template {Extract<keyof Signatures, string>} EventId
     * @param {EventId} event
     * @param {...Parameters<Signatures[EventId]>} params
     */
    fireMemorised( event, ...params ) {
        this._autoFiringEvents[ event ] = params;
        // @ts-ignore
        this.fire.apply( this, [ event ].concat( this._autoFiringEvents[ event ] ) );
        this.off( event );
    }


    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @template {Extract<keyof Signatures, string>} EventId
     * @param {EventId} event
     * @param {InstanceType<typeof EventEmitter>} target
     */
    createEventProxyOn( event, target ) {
        this.on( event, function forwardedEventCall( ...params ) {
            const fireMethod = this._autoFiringEvents[ event ] ? 'fireMemorised' : 'fire';
            target[ fireMethod ]( event, ...params );
        }, this );
    }
    /* eslint-enable jsdoc/no-undefined-types */
};
