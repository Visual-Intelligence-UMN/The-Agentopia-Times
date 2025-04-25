import { Scene } from 'phaser';
import * as assets from '../assets';
import { key } from '../constants';

export class Boot extends Scene {
  constructor() {
    super(key.scene.boot);
  }

  preload() {
    // Preloaded resources
    this.load.spritesheet(key.image.spaceman, assets.sprites.spaceman, {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet(key.image.coin, assets.sprites.coin, {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet(key.image.bird, assets.sprites.bird, {
      frameWidth: 16,
      frameHeight: 16,
    });


    
    this.load.image(key.image.tuxemon, assets.tilesets.tuxemon);
    this.load.image(key.image.office, assets.tilesets.office);
    this.load.image(key.image.room_builder_office, assets.tilesets.room_builder_office);
    this.load.image(key.image.interior, assets.tilesets.interior);
    this.load.image(key.image.exterior, assets.tilesets.exterior);
    this.load.image(key.image.coinIcon, assets.sprites.coinIcon);
    this.load.image(key.image.restart, assets.sprites.restart);
    this.load.image(key.image.start, assets.sprites.start);
    this.load.image(key.image.logo, assets.sprites.logo);
    this.load.image(key.image.mail, assets.sprites.mail);
    this.load.image(key.image.idle, assets.sprites.idle);
    this.load.image(key.image.work, assets.sprites.work);
    this.load.image(key.image.report, assets.sprites.report);
    this.load.image(key.image.hiring, assets.sprites.hiring);
    

    this.load.tilemapTiledJSON(key.tilemap.tuxemon, assets.tilemaps.tuxemon);
    this.load.tilemapTiledJSON(key.tilemap.office, assets.tilemaps.office);

    this.load.atlas(key.atlas.player, assets.atlas.image, assets.atlas.data);
    this.load.atlas(key.atlas.bias, assets.atlas.biasImage, assets.atlas.biasData);

    this.load.atlas(key.atlas.workPlayer, assets.atlas.workImage, assets.atlas.workData);
    this.load.atlas(key.atlas.workBias, assets.atlas.workBiasImage, assets.atlas.workBiasData);

    // remove it during deployment
    // this.scene.start('level2');

    // Check if there is a stored API Key
    const storedApiKey = localStorage.getItem('openai-api-key');
    
    if (storedApiKey) {
      // If there is a stored API Key, verify its validity
      this.verifyApiKey(storedApiKey).then(isValid => {
        if (isValid) {
          // API Key valid, direct access to the game scene
          this.scene.start('level2');
        } else {
          // If the API Key is invalid, go to the main menu
          this.scene.start('MainMenu');
        }
      });
    } else {
      // If there is no stored API Key, go to the Main Menu
      this.scene.start('MainMenu');
    }
  }

  private async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;  // Returns true if the request was successful
    } catch (error) {
      // console.error('Error verifying API key:', error);
      return false;  // Returns false if the request fails
    }
  }
}
