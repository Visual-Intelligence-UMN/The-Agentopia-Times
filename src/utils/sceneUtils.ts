import { render } from "phaser-jsx";
import { Depth, key, TilemapLayer, TILESET_NAME } from "../constants";
import { initKeyboardInputs, setupKeyListeners } from "./controlUtils";
import { addAgentPanelHUD, addSceneNameHUD } from "./hudUtils";
import { TilemapDebug, Typewriter } from '../components';

export function createItem(this: any, group: any, x: number, y: number, texture: any, scaleFactor = 0.25) {
    const item = group.create(x, y, texture).setScale(scaleFactor);
    this.physics.world.enable(item);

    const { width, height } = item;
    item.body.setSize(width * scaleFactor, height * scaleFactor);
    item.body.setOffset(
        (width - width * scaleFactor) / 2,
        (height - height * scaleFactor) / 2
    );
}

export function addItem(this: any, itemSprite: string, itemName: string, x: number, y: number, scaleFactor = 0.25) {
  const item = this.physics.add.sprite(0, 0, itemSprite).setScale(scaleFactor);

  this.load.once('complete', () => {
    const { width, height } = item;
    item.body.setSize(width * scaleFactor, height * scaleFactor);
    item.body.setOffset(
      (width - width * scaleFactor) / 2,
      (height - height * scaleFactor) / 2
    );
  });

  const itemText = this.add.text(0, 20 * scaleFactor, itemName, {
    fontSize: `16px`,
    color: '#ffffff',
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5);

  const itemContainer = this.add.container(x, y, [item, itemText]);

  this.tweens.add({
    targets: itemText, 
    y: `+=${10 * scaleFactor}`, 
    duration: 800, 
    ease: 'Sine.easeInOut', 
    yoyo: true,
    repeat: -1, 
  });

  return { itemContainer, item };
}



export function setupHUD(this: any) {

}

export function setupScene(this: any) {

    //set up
    addSceneNameHUD.call(this);
    this.agentGroup = this.physics.add.group();
    this.cursors = initKeyboardInputs.call(this);
    this.tilemap = this.make.tilemap({ key: key.tilemap.tuxemon });

    this.itemGroup = this.physics.add.staticGroup();
    this.deductiveItem = this.physics.add.staticGroup();
    this.debatePositionGroup = this.physics.add.staticGroup();

    // Parameters are the name you gave the tileset in Tiled and
    // the key of the tileset image in Phaser's cache (name used in preload)
    const tileset = this.tilemap.addTilesetImage(
        TILESET_NAME,
        key.image.tuxemon,
    )!;

    // Parameters: layer name (or index) from Tiled, tileset, x, y
    this.tilemap.createLayer(TilemapLayer.BelowPlayer, tileset, 0, 0);
    this.worldLayer = this.tilemap.createLayer(
        TilemapLayer.World,
        tileset,
        0,
        0,
    )!;
    const aboveLayer = this.tilemap.createLayer(
        TilemapLayer.AbovePlayer,
        tileset,
        0,
        0,
    )!;

    this.worldLayer.setCollisionByProperty({ collides: true });
    this.physics.world.bounds.width = this.worldLayer.width;
    this.physics.world.bounds.height = this.worldLayer.height;

    // By default, everything gets depth sorted on the screen in the order we created things.
    // We want the "Above Player" layer to sit on top of the player, so we explicitly give it a depth.
    // Higher depths will sit on top of lower depth objects.
    aboveLayer.setDepth(Depth.AbovePlayer);

    // Set the bounds of the camera
    this.cameras.main.setBounds(
        0,
        0,
        this.tilemap.widthInPixels,
        this.tilemap.heightInPixels,
    );

    
    const squareSize = 50;
    const spacing = 20;
    const startX = 75;
    const startY = 520;
    // addAgentPanelHUD.call(this, startX, startY, squareSize, spacing);

    const mssgBtn = this.add
      .rectangle(50, 400, 50, 50, 0x000000)
      .setDepth(1002)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive()
      .setScrollFactor(0)
      .setAlpha(0.5);

    const mssgBtnText = this.add
      .text(30, 390, 'History \nMessage', {
        fontSize: '10px',
        color: '#ffffff',
      })
      .setScrollFactor(0)
      .setDepth(1003);

    mssgBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      console.log('mssgBtn clicked');

      if (this.mssgMenu) {
        console.log('Destroying mssgMenu');
        this.mssgMenu.destroy();
        this.mssgMenuText?.destroy();
        this.mssgMenu = null;
        this.mssgMenuText = null;
        this.mssgGroup.clear(true, true);
      } else {
        console.log('Creating mssgMenu');
        this.mssgMenu = this.add
          .rectangle(300, 300, 350, 125, 0x000000)
          .setDepth(1001)
          .setStrokeStyle(2, 0xffffff)
          .setScrollFactor(0)
          .setAlpha(0.5);

        this.mssgGroup = this.add.group();

        for (let i = 0; i < this.mssgData.length; i++) {
          const mssg = this.playerControlledAgent.getMemory()[i];
          const mssgText = `${mssg.gpt}`;
          const mssgBox = this.add
            .rectangle(300 - 140 + i * 75, 290, 50, 50, 0x000000)
            .setScrollFactor(0)
            .setDepth(1003)
            .setAlpha(0.5);

          let color = "#ff0000";
          if(this.playerControlledAgent.getMemory()[i].result){
            color = "#ffffff";
          }

          const mssgLabel = this.add
            .text(300 - 140 + i * 75 - 15, 280, `Histor\nMessage ${i}`, {
              fontSize: '10px',
              color: color,
            })
            .setScrollFactor(0)
            .setDepth(1004);

          mssgBox.setInteractive({ useHandCursor: true });
          mssgBox.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            const worldPoint = this.cameras.main.getWorldPoint(
              pointer.x,
              pointer.y,
            );

            if (!this.subMssg) {
              this.subMssgText = this.add
                .text(worldPoint.x, worldPoint.y, mssgText, {
                  fontSize: '10px',
                  color: '#ffffff',
                  wordWrap: { width: 150, useAdvancedWrap: true },
                })
                .setDepth(1010)
                .setScrollFactor(1)
                .setAlpha(1);

              this.subMssg = this.add
                .rectangle(
                  worldPoint.x,
                  worldPoint.y,
                  175,
                  this.subMssgText.height + 50,
                  0x000000,
                )
                .setDepth(1007)
                .setStrokeStyle(2, 0xffffff)
                .setAlpha(1)
                .setOrigin(0, 0);

                if (this.promptContainer) {
                  this.promptContainer.list.forEach((child:any) => child.destroy());
                  this.promptContainer.destroy(true);
                  this.promptContainer = null;
                }

              this.promptContainer = this.add.container(0, 0).setDepth(1100);


              for(let i = 0; i < mssg.currentPrompts.length; i++){
                const promptRect = this.add.rectangle(
                  worldPoint.x + 200,
                  worldPoint.y + i * 20,
                  150,
                  20,
                  0x000000,
                ).setDepth(1100)
                .setStrokeStyle(2, 0xffffff)
                .setAlpha(1)
                .setOrigin(0, 0);
                

                const promptText = this.add.text(
                  worldPoint.x + 200,
                  worldPoint.y + i * 20,
                  mssg.currentPrompts[i],
                  {
                    fontSize: '10px',
                    color: '#ffffff',
                    wordWrap: { width: 150, useAdvancedWrap: true },
                  },
                ).setDepth(1101)
                .setScrollFactor(1)
                .setAlpha(1);
                

                this.promptContainer.add(promptRect);
                this.promptContainer.add(promptText);
              }

              console.log('subMssgText', this.subMssgText, this.subMssg);
            }
          });

          mssgBox.on('pointerout', () => {
            if (this.subMssg) {
              this.subMssg.destroy();
              this.subMssgText?.destroy();
              this.subMssg = null;
              this.subMssgText = null;
              this.promptContainer.list.forEach((child:any) => child.destroy());
              this.promptContainer.destroy(true);
              this.promptContainer = null;
            }
          });

          this.mssgGroup.add(mssgBox);
          this.mssgGroup.add(mssgLabel);
        }
      }
    });

    this.controlMapping = [
      { activateIndex: 0, triggerKey: Phaser.Input.Keyboard.KeyCodes.ONE },
      { activateIndex: 1, triggerKey: Phaser.Input.Keyboard.KeyCodes.TWO },
      { activateIndex: 2, triggerKey: Phaser.Input.Keyboard.KeyCodes.THREE },
    ];

    this.keyMap = setupKeyListeners(this.controlMapping, this.input);

    for (let i = 0; i < 3; i++) {
      const text = this.add.text(
        startX + i * (squareSize + spacing) - 15,
        startY - 15,
        `empty`,
        {
          fontSize: '10px',
          color: '#ffffff',
          wordWrap: { width: squareSize, useAdvancedWrap: true },
        },
      );
      this.promptTexts.push(text);
      text.setScrollFactor(0);
      text.setDepth(1000);
    }

}



