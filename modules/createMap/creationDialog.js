const Enums = require( '../core/enums.js' ),
    mwApi = new mw.Api(),
    { PREFERRED_SCHEMA_VERSION } = require( '../config.json' );


function CreationDialog( config ) {
    OO.ui.ProcessDialog.call( this, config );
}
OO.inheritClass( CreationDialog, OO.ui.ProcessDialog );


CreationDialog.static.name = 'mveCreationDialog';
CreationDialog.static.title = mw.msg( 'datamap-vec-title' );
CreationDialog.static.actions = [
    {
        modes: [ 'create' ],
        label: mw.msg( 'datamap-ve-cancel' ),
        flags: [ 'safe', 'close' ]
    }
];


const CrsType = {
    Image: 0,
    Percent: 1,
    Custom: 2
};


CreationDialog.prototype.initialize = function () {
    OO.ui.ProcessDialog.prototype.initialize.apply( this, arguments );

    this.imageSize = [ 100, 100 ];

    this.originSelector = new OO.ui.DropdownInputWidget( {
        options: [
            { data: Enums.CRSOrigin.TopLeft, label: mw.msg( 'datamap-vec-crs-top-left' ) },
            { data: Enums.CRSOrigin.BottomLeft, label: mw.msg( 'datamap-vec-crs-bottom-left' ) }
        ]
    } );
    this.crsSelector = new OO.ui.DropdownInputWidget( {
        options: [
            { data: CrsType.Image, label: mw.msg( 'datamap-vec-crs-image' ) },
            { data: CrsType.Percent, label: mw.msg( 'datamap-vec-crs-percent' ) },
            { data: CrsType.Custom, label: mw.msg( 'datamap-vec-crs-custom' ) }
        ]
    } );
    this.crsWidth = new OO.ui.TextInputWidget( {
        type: 'number',
        value: 100
    } );
    this.crsHeight = new OO.ui.TextInputWidget( {
        type: 'number',
        value: 100
    } );
    this.imageSelector = new mw.widgets.TitleInputWidget( {
        namespace: 6,
        showImages: true,
        required: true,
        showRedirectTargets: true
    } );
    this.coordsToggle = new OO.ui.ToggleSwitchWidget( {
        value: true
    } );
    this.zoomToggle = new OO.ui.ToggleSwitchWidget( {
        value: true
    } );
    this.searchToggle = new OO.ui.ToggleSwitchWidget( {
        value: false
    } );
    this.tabberSearchToggle = new OO.ui.ToggleSwitchWidget( {
        value: false,
        disabled: true
    } );
    this.requireUIDsToggle = new OO.ui.ToggleSwitchWidget( {
        value: false
    } );
    this.prefill = new OO.ui.HiddenInputWidget( {
        name: 'wpTextbox1'
    } );
    this.skipButton = new OO.ui.ButtonInputWidget( {
        label: mw.msg( 'datamap-ve-skip' )
    } );
    this.submitButton = new OO.ui.ButtonInputWidget( {
        label: mw.msg( 'datamap-vec-submit' ),
        flags: [ 'primary', 'progressive' ],
        useInputTag: true,
        type: 'submit',
        disabled: true
    } );

    this.panel = new OO.ui.PanelLayout( {
        framed: false,
        expanded: false,
        padded: true,
        classes: [ 'ext-datamaps-vec' ],
        content: [
            $( '<p>' ).text( mw.msg( 'datamap-vec-intro' ) ),
            new OO.ui.FormLayout( {
                action: mw.util.getUrl( mw.config.get( 'wgPageName' ), {
                    action: 'submit'
                } ),
                method: 'POST',
                items: [
                    new OO.ui.FieldsetLayout( {
                        items: [
                            this.imageField = new OO.ui.FieldLayout( this.imageSelector, {
                                label: mw.msg( 'datamap-vec-select-background' ),
                                align: 'left'
                            } ),
                            new OO.ui.FieldLayout( this.originSelector, {
                                label: mw.msg( 'datamap-vec-select-crs-origin' ),
                                align: 'left'
                            } ),
                            new OO.ui.FieldLayout( this.crsSelector, {
                                label: mw.msg( 'datamap-vec-select-crs' ),
                                align: 'left'
                            } ),
                            this.crsCustomPanel = new OO.ui.PanelLayout( {
                                padded: true,
                                framed: true,
                                expanded: false,
                                content: [
                                    new OO.ui.FieldLayout( this.crsWidth, {
                                        label: mw.msg( 'datamap-vec-crs-width' ),
                                        align: 'left'
                                    } ),
                                    new OO.ui.FieldLayout( this.crsHeight, {
                                        label: mw.msg( 'datamap-vec-crs-height' ),
                                        align: 'left'
                                    } )
                                ]
                            } ),
                            new OO.ui.PanelLayout( {
                                framed: true,
                                padded: true,
                                expanded: false,
                                classes: [ 'datamap-collapsible' ],
                                content: [
                                    this.$extraCheckbox = $( '<input>' ).attr( 'type', 'checkbox' ),
                                    new OO.ui.LabelWidget( {
                                        label: mw.msg( 'datamap-vec-extra-options' )
                                    } ),
                                    new OO.ui.IndicatorWidget( {
                                        indicator: 'up'
                                    } ),
                                    new OO.ui.PanelLayout( {
                                        expanded: false,
                                        content: [
                                            new OO.ui.FieldLayout( this.zoomToggle, {
                                                label: mw.msg( 'datamap-vec-toggle-zoom' ),
                                                align: 'left'
                                            } ),
                                            new OO.ui.FieldLayout( this.coordsToggle, {
                                                label: mw.msg( 'datamap-vec-toggle-coord-display' ),
                                                align: 'left'
                                            } ),
                                            new OO.ui.FieldLayout( this.searchToggle, {
                                                label: mw.msg( 'datamap-vec-toggle-search' ),
                                                align: 'left'
                                            } ),
                                            new OO.ui.FieldLayout( this.tabberSearchToggle, {
                                                label: mw.msg( 'datamap-vec-toggle-search-tabber' ),
                                                align: 'left'
                                            } ),
                                            new OO.ui.FieldLayout( this.requireUIDsToggle, {
                                                label: mw.msg( 'datamap-vec-toggle-uid-requirement' ),
                                                align: 'left'
                                            } )
                                        ]
                                    } )
                                ]
                            } ),
                            new OO.ui.HiddenInputWidget( {
                                name: 'wpUnicodeCheck',
                                value: 'ℳ𝒲♥𝓊𝓃𝒾𝒸ℴ𝒹ℯ'
                            } ),
                            new OO.ui.HiddenInputWidget( {
                                name: 'wpEditToken',
                                value: mw.user.tokens.get( 'csrfToken' )
                            } ),
                            new OO.ui.HiddenInputWidget( {
                                name: 'model',
                                value: 'datamap'
                            } ),
                            new OO.ui.HiddenInputWidget( {
                                name: 'format',
                                value: 'application/json'
                            } ),
                            this.prefill,
                            new OO.ui.HiddenInputWidget( {
                                name: 'wpPreview',
                                value: '1'
                            } ),
                            new OO.ui.HiddenInputWidget( {
                                name: 'wpUltimateParam',
                                value: '1'
                            } ),
                            new OO.ui.FieldLayout( new OO.ui.ButtonGroupWidget( {
                                items: [ this.skipButton, this.submitButton ]
                            } ) )
                        ]
                    } )
                ]
            } )
        ]
    } );

    this.crsCustomPanel.toggle( false );
    this.crsSelector.on( 'change', () => this.updateCrs() );

    this.imageSelector.on( 'change', () => this.fetchImageInfo() );
    this.$extraCheckbox.on( 'change', () => this.updateSize() );

    this.searchToggle.on( 'change', () => {
        this.tabberSearchToggle.setDisabled( !this.searchToggle.getValue() );
    } );

    this.skipButton.on( 'click', this.skip, null, this );
    this.submitButton.on( 'click', this.updatePrefillValue, null, this );

    this.$body.append( this.panel.$element );
};


// Set up the initial mode of the window
CreationDialog.prototype.getSetupProcess = function ( data ) {
    return OO.ui.ProcessDialog.prototype.getSetupProcess.call( this, data )
        .next( () => this.actions.setMode( 'create' ), this );
};


CreationDialog.static.GOOD_MIME_TYPES = [ 'image/jpeg', 'image/png', 'image/svg+xml', 'image/gif' ];
CreationDialog.static.POOR_MIME_TYPES = [ 'image/png', 'image/gif' ];


CreationDialog.prototype.fetchImageInfo = function () {
    this.submitButton.setDisabled( true );

    this.imageField.setNotices( [] );
    this.imageField.setErrors( [] );
    this.imageField.setWarnings( [] );

    mwApi.get( {
        action: 'query',
        titles: 'File:' + this.imageSelector.getValue(),
        prop: 'imageinfo',
        iiprop: 'size|url|mime'
    } ).then( data => {
        // eslint-disable-next-line compat/compat
        const pageInfo = Object.values( data.query.pages )[ 0 ];
        if ( !pageInfo.imageinfo ) {
            return;
        }

        const imageInfo = pageInfo.imageinfo[ 0 ];

        this.imageField.setNotices( [
            mw.msg( 'datamap-vec-note-image-size', imageInfo.width, imageInfo.height )
        ] );

        if ( CreationDialog.static.GOOD_MIME_TYPES.indexOf( imageInfo.mime ) < 0 ) {
            this.imageField.setErrors( [
                mw.msg( 'datamap-vec-error-bad-file-type', imageInfo.mime )
            ] );
        }

        if ( CreationDialog.static.POOR_MIME_TYPES.indexOf( imageInfo.mime ) >= 0 ) {
            this.imageField.setWarnings( [
                mw.msg( 'datamap-vec-error-poor-file-type', imageInfo.mime )
            ] );
        }

        this.imageSize = [ imageInfo.width, imageInfo.height ];

        this.updateCrs();
        this.updateButtonState();
        this.updateSize();
    } );
};


CreationDialog.prototype.updateButtonState = function () {
    this.submitButton.setDisabled( this.imageField.errors.length > 0 );
};


CreationDialog.prototype.updateCrs = function () {
    this.crsCustomPanel.toggle( this.crsSelector.getValue() === `${CrsType.Custom}` );
    this.updateSize();
    switch ( parseInt( this.crsSelector.getValue() ) ) {
        case CrsType.Percent:
            this.crsWidth.setValue( 100 );
            this.crsHeight.setValue( 100 );
            break;
        case CrsType.Image:
            this.crsWidth.setValue( this.imageSize[ 0 ] );
            this.crsHeight.setValue( this.imageSize[ 1 ] );
            break;
    }
};


CreationDialog.prototype.skip = function () {
    this.pushPending();
    location.href = mw.util.getUrl( mw.config.get( 'wgPageName' ), {
        action: 'edit'
    } );
};


CreationDialog.prototype.updatePrefillValue = function () {
    this.pushPending();

    const imageSize = [
        parseFloat( this.crsWidth.getValue() ),
        parseFloat( this.crsHeight.getValue() )
    ];

    /** @type {any} */
    const out = {
        $schema: new mw.Uri( `${mw.config.get( 'wgExtensionAssetsPath' )}/DataMaps/schemas/${PREFERRED_SCHEMA_VERSION}.json` )
            .toString(),
        crs: {
            topLeft: [ 0, 0 ],
            bottomRight: imageSize,
            order: 'xy'
        },
        background: this.imageSelector.getValue(),
        settings: {}
    };

    if ( this.originSelector.getValue() === `${Enums.CRSOrigin.BottomLeft}` ) {
        [ out.crs.topLeft, out.crs.bottomRight ] = [ out.crs.bottomRight, out.crs.topLeft ];
    }

    if ( !this.zoomToggle.getValue() ) {
        out.settings.zoom = { lock: true };
    }

    if ( this.searchToggle.getValue() ) {
        out.settings.enableSearch = true;

        if ( this.tabberSearchToggle.getValue() ) {
            out.settings.enableSearch = 'tabberWide';
        }
    }

    if ( this.requireUIDsToggle.getValue() ) {
        out.settings.requireCustomMarkerIDs = true;
    }

    if ( !this.coordsToggle.getValue() ) {
        out.settings.showCoordinates = false;
    }

    if ( Object.keys( out.settings ).length === 0 ) {
        delete out.settings;
    }

    out.groups = {
        [ mw.msg( 'datamap-vec-example-group-id' ) ]: {
            name: mw.msg( 'datamap-vec-example-group-name' ),
            pinColor: '#f00'
        }
    };
    out.markers = {
        [ mw.msg( 'datamap-vec-example-group-id' ) ]: [
            {
                x: 50,
                y: 50,
                name: mw.msg( 'datamap-vec-example-marker' )
            }
        ]
    };
    this.prefill.$element.attr( 'value', JSON.stringify( out, null, '\t' ) );

    this.$body.find( 'form' ).trigger( 'submit' );
};


module.exports = CreationDialog;
