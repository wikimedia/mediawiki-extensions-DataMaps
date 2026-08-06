declare namespace DataMaps {
    type PointTupleRepr = ApiMarkerInstance | LeafletModule.LatLngTuple;

    enum CoordinateOrder {
        YX,
        XY
    }

    enum CoordinateOrigin {
        TopLeft = 1,
        BottomLeft = 2
    }


    interface IExposedServerSettings {
        IsBleedingEdge: boolean;
        IsVisualEditorEnabled: boolean;
        TabberNeueModule: string;
        CanAnonsEdit: boolean;
    }


    interface LocalMapUserData extends Record<string, any> {
        background: number;
        dismissed: string[];
    }


    namespace Configuration {
        interface BaseMarkerGroup {
            name: string;
            description?: string;
            flags?: number;
            legendIcon?: string;
            article?: string;
        }

        interface VectorMarkerGroup extends BaseMarkerGroup {
            strokeColor?: string;
            strokeWidth?: number;
        }

        interface IconMarkerGroup extends BaseMarkerGroup {
            size: LeafletModule.PointTuple;
            markerIcon: string;
        }

        interface PinMarkerGroup extends VectorMarkerGroup {
            size: LeafletModule.PointTuple;
            pinColor: string;
        }

        interface CircleMarkerGroup extends VectorMarkerGroup {
            size: number;
            fillColor: string;
            zoomScaleFactor?: number;
        }

        type MarkerGroup = IconMarkerGroup|PinMarkerGroup|CircleMarkerGroup;
        type IconBasedMarkerGroup = IconMarkerGroup|PinMarkerGroup;

        interface MarkerLayer {
            name?: string;
            discrim?: string;
            markerIcon?: string;
        }

        interface BackgroundOverlay {
            name?: string;
            at: LeafletModule.LatLngBoundsTuple;
            image?: string;
            aa?: boolean;
            pixelated?: boolean;
            path?: LeafletModule.PointTuple[];
            thickness?: number;
            colour?: string;
            strokeColour?: string;
        }

        interface Background {
            name?: string;
            image?: string;
            at: LeafletModule.LatLngBoundsTuple;
            aa?: boolean;
            pixelated?: boolean;
            layer: string;
            overlays?: BackgroundOverlay[];
            // Runtime
            layers: LeafletModule.Layer[];
        }
        
        interface Map {
            version: number;
            cOrder: CoordinateOrder;
            crs: LeafletModule.LatLngBoundsTuple;
            flags: number;
            backdrop?: string;
            zoom?: {
                lock: boolean;
                auto: boolean;
                min: number;
                max: number;
            };
            leafletSettings: LeafletModule.IPublicMapOptions;
            backgrounds: Background[];
            layerIds: string[];
            groups: Record<string, MarkerGroup>;
            layers: Record<string, MarkerLayer>;
            disclaimer?: string;
            custom?: any;
        }
    }

    type RuntimeMarkerProperties = Record<string, string>;
    type SearchKeywordWeighing = [ string, number ];
    interface IApiMarkerSlots {
        uid?: string;
        label?: string;
        desc?: string;
        article?: string;
        scale?: number;
        icon?: string;
        image?: [ string, number, number, number, number? ];
        search?: 0 | SearchKeywordWeighing[];
    }
    type ApiMarkerInstance = [ number, number, IApiMarkerSlots ];
    type UncheckedApiMarkerInstance = [ number, number, IApiMarkerSlots|null ];

    interface IHasRuntimeMarkerState {
        /* Fields internally used and set by the extension */
        apiInstance: ApiMarkerInstance;
        attachedLayers: string[];
        assignedProperties: RuntimeMarkerProperties;
    }

    namespace EventHandling {
        export type ListenerSignature = Record<string, (...args: any[]) => any>;

        type MapListenerSignatures = {
            'leafletLoaded': EventListenerFn;
            'leafletLoadedLate': EventListenerFn;
            'legendLoaded': EventListenerFn;
            'customData': (data: any) => void;
            'deactivate': EventListenerFn;
            'backgroundChange': MapBackgroundChangeListenerFn;
            'chunkStreamingDone': EventListenerFn;
            'chunkStreamed': ( markers: LeafletModule.AnyMarker[] ) => void;
            'linkedEvent': LinkedEventListenerFn;
            'sendLinkedEvent': LinkedEventListenerFn;
            'markerVisibilityUpdate': EventListenerFn;
            'legendManager': EventListenerFn;
            'markerReady': ( marker: LeafletModule.AnyMarker ) => void;
            'modifyMarkerOptions':
                ( (
                    cls: typeof LeafletModule.Marker | typeof LeafletModule.CanvasIconMarker,
                    instance: ApiMarkerInstance,
                    markerOptions: LeafletModule.MarkerOptions
                ) => void ) | ( (
                    cls: typeof LeafletModule.CircleMarker,
                    instance: ApiMarkerInstance,
                    markerOptions: LeafletModule.CircleMarkerOptions
                ) => void );
            'collectiblesPanel': EventListenerFn;
            'markerFilteringPanel': EventListenerFn;
            'markerDismissChange': ( marker: LeafletModule.AnyMarker ) => void;
            'groupDismissChange': ( groupId: string ) => void;
        }

        type EventListenerFn = () => void;
        type MapBackgroundChangeListenerFn = ( index: number, config: Configuration.Background ) => void;
        type LinkedEventListenerFn = ( event: Linked.Event ) => void;


        namespace Linked {
            interface IGenericEvent {
                type: string;
                map?: import( './core/map.js' );
            }

            interface IGroupDismissChangeEvent extends IGenericEvent {
                type: 'groupDismissChange';
                groupId: string;
                state: boolean;
            }

            type Event = IGenericEvent | IGroupDismissChangeEvent;
        }

        type VeListenerSignatures = {
            'sourceData': EventListenerFn,
            'ready': EventListenerFn,
            'save': EventListenerFn,
            'markers': EventListenerFn
        }
    }
}


declare namespace Internal {
    export type Core = typeof DataMaps;
}
