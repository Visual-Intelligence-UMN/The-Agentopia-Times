import * as scenes from './scenes';
import { Game } from 'phaser';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
  width: 800, // 1024
  height: 600, // 768
  title: 'Phaser RPG',
  url: import.meta.env.VITE_APP_HOMEPAGE,
  version: import.meta.env.VITE_APP_VERSION,
  scene: [
    scenes.Boot,
    scenes.MainMenu,
    scenes.Level1,
    scenes.Level2,
  ],
  physics: {
    default: 'arcade',
    arcade: {
      // debug: import.meta.env.DEV,
      debug: false,
    },
  },
  disableContextMenu: import.meta.env.PROD,
  backgroundColor: '#000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
}

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
