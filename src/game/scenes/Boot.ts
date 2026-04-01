import { Scene } from 'phaser';

import { getGameConfig } from '../config';
import { key } from '../constants';

export class Boot extends Scene {
    constructor() {
        super(key.scene.boot);
    }

    preload() {
        const gameConfig = getGameConfig();

        gameConfig.assets.bitmapFonts.forEach((font) => {
            this.load.bitmapFont(font.key, font.textureSrc, font.dataSrc as any);
        });

        gameConfig.assets.spritesheets.forEach((sheet) => {
            this.load.spritesheet(sheet.key, sheet.src as string, {
                frameWidth: sheet.frameWidth,
                frameHeight: sheet.frameHeight,
            });
        });

        gameConfig.assets.images.forEach((image) => {
            this.load.image(image.key, image.src as string);
        });

        gameConfig.assets.tilemaps.forEach((tilemap) => {
            this.load.tilemapTiledJSON(tilemap.key, tilemap.src as any);
        });

        gameConfig.assets.atlases.forEach((atlas) => {
            this.load.atlas(
                atlas.key,
                atlas.textureSrc as any,
                atlas.dataSrc as any,
            );
        });

        const storedApiKey = localStorage.getItem('openai-api-key');

        if (storedApiKey) {
            this.verifyApiKey(storedApiKey).then((isValid) => {
                if (isValid) {
                    this.scene.start(gameConfig.defaults.startScene);
                } else {
                    this.scene.start('MainMenu');
                }
            });
        } else {
            this.scene.start('MainMenu');
        }
    }

    private async verifyApiKey(apiKey: string): Promise<boolean> {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.ok;
        } catch {
            return false;
        }
    }
}
