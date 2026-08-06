import InternalExtensionTypes = DataMaps;


declare namespace LeafletModule {
    class LatLng {
        constructor(latitude: number, longitude: number, altitude?: number);
        equals(otherLatLng: LatLngLike, maxMargin?: number): boolean;
        toString(): string;
        distanceTo(otherLatLng: LatLngLike): number;
        wrap(): LatLng;
        toBounds(sizeInMeters: number): LatLngBounds;
        clone(): LatLng;

        lat: number;
        lng: number;
        alt?: number | undefined;
    }


    class Point {
        x: number;
        y: number;
    }


    type PointTuple = [ number, number ];
    type PointLike = Point|PointTuple;
    type LatLngTuple = [ number, number ];
    type LatLngLike = LatLng | LatLngTuple;


    function toPoint( p: PointLike ): Point;



    class LatLngBounds {
        constructor();
        constructor( southWest: LatLngLike, northEast: LatLngLike );
        constructor( latlngs: LatLngBounds );
        extend(latlngOrBounds: LatLngLike | LatLngBounds | LatLngBoundsTuple): this;
        pad(bufferRatio: number): LatLngBounds;
        getCenter(): LatLng;
        getSouthWest(): LatLng;
        getNorthEast(): LatLng;
        getNorthWest(): LatLng;
        getSouthEast(): LatLng;
        getWest(): number;
        getSouth(): number;
        getEast(): number;
        getNorth(): number;
        contains(otherBoundsOrLatLng: LatLngBoundsTuple | LatLngLike): boolean;
        intersects(otherBounds: LatLngBoundsTuple): boolean;
        overlaps(otherBounds: LatLngBoundsTuple): boolean;
        toBBoxString(): string;
        equals(otherBounds: LatLngBoundsTuple): boolean;
        isValid(): boolean;
    }


    type LatLngBoundsTuple = [ LatLngTuple, LatLngTuple ];
    type LatLngBoundsLike = LatLngBoundsTuple | LatLngBounds;


    namespace Ark {
        export interface PinIconOptions {
            colour: string;
            strokeColour: string;
            strokeWidth: number;
            iconSize: PointTuple;
            useWithCanvas?: boolean;
        }

        export class Popup extends LeafletModule.Popup {}
        export class KeybindInteractionControl extends LeafletModule.Handler {}
        export class SleepInteractionControl extends LeafletModule.Handler {}
        export class PinIcon extends LeafletModule.Icon {
            constructor( options: PinIconOptions );
        }

        export interface IPopupContentRenderer {
            shouldKeepAround(): boolean;
            buildButtons( element: HTMLElement ): void;
            build( element: HTMLElement ): void;

            onAdd( isTooltip: boolean ): void;
            onPromoted(): void;
            onRemove( wasTooltip: boolean ): void;
        }

        export type PopupContentRendererGetterFn = () => IPopupContentRenderer;
    }


    namespace Browser {
        export const mobile: boolean;
        export const retina: boolean;
    }


    namespace DomUtil {
        export function create( tagName: string, className: string, container?: HTMLElement ): HTMLElement;
        export function setPosition( element: HTMLElement, point: Point ): void;
    }


    export interface CRS {
        latLngToPoint(latlng: LatLngLike, zoom: number): PointTuple;
        pointToLatLng(point: PointTuple, zoom: number): LatLng;
        project(latlng: LatLngLike): PointTuple;
        unproject(point: PointTuple): LatLng;
        scale(zoom: number): number;
        zoom(scale: number): number;
        getProjectedBounds(zoom: number): LatLngBoundsLike;
        distance(latlng1: LatLngLike, latlng2: LatLngLike): number;
        wrapLatLng(latlng: LatLngLike): LatLng;

        code?: string | undefined;
        wrapLng?: [number, number] | undefined;
        wrapLat?: [number, number] | undefined;
        infinite: boolean;
    }


    export namespace CRS {
        const Simple: CRS;
    }


    interface IPublicMapOptions {
        center?: LatLngLike;
        maxBoundsViscosity?: number;
        zoomSnap: number;
        zoomDelta?: number;
        maxZoom: number;
        wheelPxPerZoomLevel?: number;
        minZoom: number;
        zoomAnimation?: boolean;
        markerZoomAnimation?: boolean;
        bounceAtZoomLimits?: boolean;
        inertia?: boolean;
        /* Control settings */
        zoomControl?: boolean;
        boxZoom?: boolean;
        doubleClickZoom?: boolean;
        scrollWheelZoom?: boolean;
        touchZoom?: boolean;
        zoomControlOptions?: {
            zoomInTitle?: string;
            zoomOutTitle?: string;
        };
        /* Non-standard options */
        rendererSettings: CanvasOptions;
        uriPopupZoom?: number|false;
        autoMinZoom?: boolean;
        autoMinZoomAbsolute: number;
        shouldScaleMarkers?: boolean;
        markerZoomScaleFactor?: number;
        interactionControl?: boolean;
        allowIconsOnCanvas?: boolean;
    }


    interface MapOptions extends IPublicMapOptions {
        maxBounds?: LatLngBoundsLike;
        crs?: CRS;
        renderer?: Renderer;
        /* Non-standard options */
        vecMarkerScale?: number;
        iconMarkerScale?: number;
        uriPopupZoom?: number;
    }


    interface IconOptions {
        iconUrl: string;
        iconSize: PointTuple;
        iconAnchor?: PointTuple;
        useWithCanvas?: boolean;
    }


    interface CanvasOptions {
        padding: number;
    }

    interface PopupOptions {
        keepInView?: boolean;
        tooltip?: boolean;
    }

    interface MarkerOptions {
        icon: Icon;
        dismissed?: boolean;
    }

    interface PathOptions {
        stroke?: boolean;
        color?: string;
        weight?: number;
        opacity?: number;
        dashArray?: string;
        dashOffset?: string;
        fill?: boolean;
        fillColor?: string;
        fillOpacity?: number;
        interactive?: boolean;
        bubblingMouseEvents?: boolean;
    }

    interface PolylineOptions extends PathOptions {
        smoothFactor?: number;
        noClip?: boolean;
    }

    interface PolygonOptions extends PolylineOptions {
        fill?: boolean;
    }

    interface CanvasIconMarkerOptions extends PathOptions {
        icon: Icon;
        dismissed?: boolean;
    }

    interface CircleMarkerOptions {
        radius: number;
        zoomScaleFactor?: number;
        fillColor: string;
        fillOpacity: number;
        color: string;
        weight: number;
        dismissed?: boolean;
    }


    interface ImageOverlayOptions {
        className?: string;
        decoding?: 'auto' | 'sync' | 'async';
        antiAliasing?: number;
    }


    abstract class Class {
        static extend<TSubclass extends typeof Class, TBody>( this: TSubclass, props: TBody ):
            { new( ...args: any[] ): InstanceType<TSubclass> & TBody };
    }


    abstract class Layer extends Class {
        _map?: Map;

        getLatLng(): LatLng;
        addTo(map: Map): this;
        remove(): this;
        bringToBack(): this;
        bindPopup( fn: Ark.PopupContentRendererGetterFn, options: PopupOptions, classOverride: typeof Popup ): this;
        openPopup( latlng?: LatLngLike ): this;
        closePopup(): this;
        bindTooltip( text: string ): this;
    }

    type LayerMap = Record<number, Layer>;


    interface IHasBoundsGetter {
        getBounds(): LatLngBounds;
    }


    namespace EventHandling {
        interface EventContext {
            type: string;
            popup: any;
            target: any;
            sourceTarget: any;
            propagatedFrom: any;
        }

        interface MouseEvent extends EventContext {
            latlng: LatLng;
            layerPoint: PointTuple;
            containerPoint: PointTuple;
            originalEvent: MouseEvent;
        }

        type EventHandlerFn = ( event: EventHandling.EventContext ) => void;
        type MouseEventHandlerFn = ( event: EventHandling.MouseEvent ) => void;
    }


    class Map extends Class {
        constructor(element: HTMLElement, options: MapOptions);

        getContainer(): HTMLElement;
        addLayer(layer: Layer): this;
        removeLayer(layer: Layer): this;
        addHandler(name: string, handlerClass: typeof Handler): this;
        closePopup( popup?: Popup ): this;
        getZoom(): number;
        setZoom( zoom: number ): this;
        fitBounds( bounds: LatLngBounds, options?: Partial<{
            paddingTopLeft: PointLike
        }> ): this;
        flyTo( point: LatLngLike, zoom?: number ): this;
        setView( center: LatLngLike, zoom?: number ): this;
        setMinZoom( zoom: number ): this;
        getBoundsZoom( bounds: LatLngBounds, inside?: boolean, padding?: PointTuple ): number;
        setMaxBounds( bounds: LatLngBounds ): this;
        latLngToContainerPoint( latlng: LatLng ): PointLike;
        containerPointToLatLng( point: PointLike ): LatLng;

        on( type: 'click' | 'dblclick' | 'mousedown' | 'mouseup' | 'mouseover' | 'mouseout' | 'mousemove' | 'contextmenu'
            | 'preclick', fn: EventHandling.MouseEventHandlerFn, context?: any ): this;
        on( type: string, fn: EventHandling.EventHandlerFn, context?: any ): this;
        off( type: string, fn: Function, context?: object ): void;

        _haveLayersMutated: boolean;
        _fadeAnimated: boolean;
        _layers: LayerMap;
        options: MapOptions;
        interactionControl?: Ark.InteractionControl;
    }

    class Handler extends Class {
        enable(): void;
        disable(): void;
        enabled(): boolean;
        addHooks(): void;
        removeHooks(): void;
    }

    class DivOverlay extends Layer {}

    class Popup extends DivOverlay {
        constructor( options: PopupOptions, source: Layer );
        constructor( latlng: LatLng, options: PopupOptions );

        onAdd( map: Map ): void;
        onRemove( map: Map ): void;

        _initLayout(): void;
        _updateLayout(): void;
    }

    class Icon {
        constructor( options: IconOptions );
    }

    abstract class Renderer extends Layer {
        _layers: Layer[];
    }

    class Canvas extends Renderer {
        constructor( options: CanvasOptions );
    }

    class CircleMarker extends Path implements InternalExtensionTypes.IHasRuntimeMarkerState {
        constructor( position: LatLngLike, options: CircleMarkerOptions );

        getBounds(): LatLngBounds;
        setDismissed( value: boolean ): void;

        options: CircleMarkerOptions;
        /* Fields internally used and set by the extension */
        apiInstance: InternalExtensionTypes.ApiMarkerInstance;
        attachedLayers: string[];
        assignedProperties: InternalExtensionTypes.RuntimeMarkerProperties;
    }

    class Marker extends Layer implements InternalExtensionTypes.IHasRuntimeMarkerState {
        constructor( position: LatLngLike, options: MarkerOptions );
        setDismissed( value: boolean ): void;

        options: MarkerOptions;
        /* Fields internally used and set by the extension */
        apiInstance: InternalExtensionTypes.ApiMarkerInstance;
        attachedLayers: string[];
        assignedProperties: InternalExtensionTypes.RuntimeMarkerProperties;
    }

    class CanvasIconMarker extends Path implements InternalExtensionTypes.IHasRuntimeMarkerState {
        constructor( position: LatLngLike, options: MarkerOptions );
        setDismissed( value: boolean ): void;

        options: CanvasIconMarkerOptions;
        /* Fields internally used and set by the extension */
        apiInstance: InternalExtensionTypes.ApiMarkerInstance;
        attachedLayers: string[];
        assignedProperties: InternalExtensionTypes.RuntimeMarkerProperties;
    }

    type AnyMarker = Marker|CanvasIconMarker|CircleMarker;
    type AnyMarkerType = typeof Marker|typeof CanvasIconMarker|typeof CircleMarker;

    class ImageOverlay extends Layer {
        constructor( url: string, bounds: LatLngBoundsLike, options: ImageOverlayOptions );

        getBounds(): LatLngBounds;
    }

    abstract class Path extends Layer {
        options: PathOptions;
    }
    
    class Polyline extends Path {
        constructor( latlngs: LatLngLike[], options: PolylineOptions );

        getBounds(): LatLngBounds;

        options: PolylineOptions;
    }

    class Polygon extends Polyline {
        constructor( latlngs: LatLngLike[], options: PolygonOptions );

        options: PolygonOptions;
    }

    class Rectangle extends Polygon {
        constructor( latLngBounds: LatLngBoundsLike, options: PolygonOptions );
    }
}
