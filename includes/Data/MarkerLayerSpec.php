<?php
namespace MediaWiki\Extension\DataMaps\Data;

use stdClass;

class MarkerLayerSpec extends DataModel {
    protected static string $publicName = 'MarkerLayerSpec';

    private string $id;

    public function __construct( string $id, stdClass $raw ) {
        parent::__construct( $raw );
        $this->id = $id;
    }

    public function getId(): string {
        return $this->id;
    }

    public function getName(): ?string {
        return isset( $this->raw->name ) ? $this->raw->name : null;
    }

    public function getPopupDiscriminator(): ?string {
        return isset( $this->raw->subtleText ) ? $this->raw->subtleText : null;
    }

    public function getIconOverride(): ?string {
        return isset( $this->raw->overrideIcon ) ? $this->raw->overrideIcon : null;
    }
}
