import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { TilemapDebug, Typewriter } from '../components';
import {
  Depth,
  key,
  TilemapLayer,
  TilemapObject,
  TILESET_NAME,
} from '../constants';
import { Player } from '../sprites';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { fetchChatCompletion } from '../server/server';
import { HUDScene } from './HUD';
import { TextInput } from '../components/TextInput';
import { TextField } from '@mui/material';
import { Inventory } from '../components/Inventory';

interface Sign extends Phaser.Physics.Arcade.StaticBody {
  text?: string;
}

export class Main extends Phaser.Scene {
  private player!: Player;
  private sign!: Sign;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private worldLayer!: Phaser.Tilemaps.TilemapLayer;
  private itemGroup!: Phaser.Physics.Arcade.StaticGroup;
  private deductiveItem!: Phaser.Physics.Arcade.StaticGroup;
  private npc!: Phaser.Physics.Arcade.Sprite;
  private hudText!: Phaser.GameObjects.Text;
  private inventory!: Inventory;
  private promptTexts: Phaser.GameObjects.Text[] = [];
  private persona: string = "You name is Elias. Elias is a lifelong resident of Willowbrook Village, where he has cultivated a reputation as a knowledgeable herbalist and a reliable farmer. He lives a simple life, tending to his crops and helping fellow villagers with remedies for common ailments. He prefers a peaceful existence, avoiding unnecessary conflicts, but he has a strong sense of justice when it comes to protecting his home and people."

  constructor() {
    super(key.scene.main);
  }

  create() {
    this.tilemap = this.make.tilemap({ key: key.tilemap.tuxemon });

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

    // this.scene.launch('HUDScene');

    // this.npc = this.physics.add.sprite(1000, 500, 'npcSprite');
    // this.npc.setImmovable(true);

    // By default, everything gets depth sorted on the screen in the order we created things.
    // We want the "Above Player" layer to sit on top of the player, so we explicitly give it a depth.
    // Higher depths will sit on top of lower depth objects.
    aboveLayer.setDepth(Depth.AbovePlayer);

    this.addPlayer();

    this.itemGroup = this.physics.add.staticGroup();
    this.deductiveItem = this.physics.add.staticGroup();
    
    const item1 = this.itemGroup.create(400, 1000, 'logo').setScale(0.25);
    const item2 = this.deductiveItem.create(500, 1100, 'logo').setScale(0.25);

    this.physics.world.enable([item1, item2]);

    const originalWidth = item1.width;  
    const originalHeight = item1.height; 
    const scaleFactor = 0.25; 

    item1.body.setSize(originalWidth * scaleFactor, originalHeight * scaleFactor);
    item1.body.setOffset(
      (originalWidth - originalWidth * scaleFactor) / 2, 
      (originalHeight - originalHeight * scaleFactor) / 2
    );

    item2.body.setSize(originalWidth * scaleFactor, originalHeight * scaleFactor);
    item2.body.setOffset(
      (originalWidth - originalWidth * scaleFactor) / 2, 
      (originalHeight - originalHeight * scaleFactor) / 2
    );

    this.physics.add.overlap(
      this.player,
      this.itemGroup,
      this.collectItem,
      undefined,
      this
    );

    this.physics.add.overlap(
      this.player,
      this.deductiveItem,
      this.collectDeductiveReasoning,
      undefined,
      this
    );

    this.physics.add.overlap(
      this.player,
      this.npc,
      this.onPlayerNearNPC,
      undefined,
      this
    );
    
    this.npc = new NPC(this, 600, 900);
    this.physics.add.collider(this.npc, this.worldLayer);

    this.physics.add.overlap(this.player, this.npc, this.onPlayerNearNPC, undefined, this);



    // Set the bounds of the camera
    this.cameras.main.setBounds(
      0,
      0,
      this.tilemap.widthInPixels,
      this.tilemap.heightInPixels,
    );

    render(<TilemapDebug tilemapLayer={this.worldLayer} />, this);

    this.hudText = this.add.text(50, 450, 'Agent A(Player-controlled) ' + this.player.getPromptUtils(), {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    });

    this.hudText.setScrollFactor(0); 
    this.hudText.setDepth(999);

    const frame = this.add.rectangle(200, 500, 350, 125, 0x000000);
    frame.setStrokeStyle(2, 0xffffff);
    frame.setScrollFactor(0);
    frame.setDepth(998);
    frame.setAlpha(0.5);

    const squareSize = 50; 
    const spacing = 20; 
    const startX = 75; 
    const startY = 520; 

    let popupRect: Phaser.GameObjects.Rectangle | null = null;
    let popupText: Phaser.GameObjects.Text | null = null;

    for (let i = 0; i < 3; i++) {
      const rect = this.add.rectangle(
      startX + i * (squareSize + spacing), 
      startY, 
      squareSize, 
      squareSize, 
      0x000000 
      );
      rect.setStrokeStyle(2, 0xffffff);
      rect.setScrollFactor(0);
      rect.setDepth(999);
      rect.setAlpha(0.5);
      rect.setInteractive({ useHandCursor: true });

      rect.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        console.log('pointerover', worldPoint.x, worldPoint.y);
        if (!popupRect) {
          popupRect = this.add
          .rectangle(worldPoint.x+20, worldPoint.y+20, 150, 80, 0x000000)
          .setDepth(1000)
          .setStrokeStyle(2, 0xffffff);

          console.log('popupRect add', popupRect);

          let textLabel = "empty";
          if(this.player.getPromptUtils().length > i) {
            textLabel = this.player.getPromptUtils()[i];
          }

          popupText = this.add.text(
            worldPoint.x - 35, 
            worldPoint.y, 
            textLabel, { fontSize: '10px', color: '#ffffff' }
          ).setDepth(1001);
        }
      });
    
      rect.on('pointerout', () => {
        console.log('pointerout');
        if (popupRect) {
          popupRect.destroy(); 
          popupText?.destroy();
          popupRect = null; 
          console.log('popupRect remove', popupRect);
        }
      });
    }

    // let promptTexts = [];

    for(let i = 0; i < 3; i++) {
      const text = this.add.text(
        startX + i * (squareSize + spacing)-15, 
        startY, 
        `empty`, 
        { fontSize: '10px', color: '#ffffff' }
      );
      this.promptTexts.push(text);
      text.setScrollFactor(0);
      text.setDepth(1000);
    }

    state.isTypewriting = true;
    render(
      <Typewriter
        text="WASD or arrow keys to move, space to interact."
        onEnd={() => (state.isTypewriting = false)}
      />,
      this,
    );

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.pause(key.scene.main);
      this.scene.launch(key.scene.menu);
    });
  }

  private collectItem(player: any, item: any) {
    if (state.isTypewriting || state.collectedItems?.has(item)) {
        return; 
    }

    state.isTypewriting = true;
    
    render(
      <Typewriter
          text={`Prompt Utility: think step-by-step`} 
          onEnd={() => {
              state.isTypewriting = false;
              console.log("collected prompt utils", player.getPromptUtils());
              const spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

              const destroyItem = () => {
                if (item.active) {
                  item.destroy();
                  player.addPromptUtils("think step by step");
                  console.log("Item destroyed!");
                }

                spaceKey?.off('down', destroyItem);
              };
                spaceKey?.on('down', destroyItem);
          }}
      />, this
    );
  }

  private collectDeductiveReasoning(player: any, item: any) {
    if (state.isTypewriting || state.collectedItems?.has(item)) {
        return; 
    }

    state.isTypewriting = true;
    
    render(
      <Typewriter
          text={`Prompt Utility: Deductive Reasoning`} 
          onEnd={() => {
              state.isTypewriting = false;
              console.log("collected prompt utils", player.getPromptUtils());
              const spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

                const destroyItem = () => {
                    if (item.active) {
                        item.destroy();
                        player.addPromptUtils("deductive reasoning");
                        console.log("Item destroyed!");
                    }

                    spaceKey?.off('down', destroyItem);
                };
                spaceKey?.on('down', destroyItem);

          }}
      />, this
    );
  }

  private async onPlayerNearNPC(player: any, npc: any) {
    if (player.cursors.space.isDown && !state.isTypewriting) {
      state.isTypewriting = true;
  
      const npcName = npc.getData('npcName') || 'Mysterious NPC';

      let systemMssg = `${this.persona}, this prompt is for testing`;

      if(player.getPromptUtils().length > 0) {
        systemMssg += `
        you have collected ${player.getPromptUtils()}, 
        please utilize collected prompt utils to solve the task
        `
      }

      const messages = [
        { 
          role: 'system', 
          content: systemMssg 
        },
        { 
          role: 'user', 
          content: `
            you have collected ${player.getPromptUtils()}, 
            please utilize collected prompt utils to solve the task
            please solve this task:
            How many R's are in the word strawberry?
          ` 
        }
      ];

      console.log('messages:', messages);
  
      try {
        const response = await fetchChatCompletion(messages);
        console.log('OpenAI return:', response);
  
        const aiReply = response.choices[0].message.content;
  
        render(
          <Typewriter
            text={aiReply} 
            onEnd={() => (state.isTypewriting = false)}
          />,
          this
        );
      } catch (error) {
        console.error('API request failed', error);
        state.isTypewriting = false;
      }
    }
  }


  private addPlayer() {
    // Object layers in Tiled let you embed extra info into a map like a spawn point or custom collision shapes.
    // In the tmx file, there's an object layer with a point named 'Spawn Point'.
    const spawnPoint = this.tilemap.findObject(
      TilemapLayer.Objects,
      ({ name }) => name === TilemapObject.SpawnPoint,
    )!;

    this.player = new Player(this, spawnPoint.x!, spawnPoint.y!);
    this.addPlayerSignInteraction();

    // Watch the player and worldLayer for collisions
    this.physics.add.collider(this.player, this.worldLayer);
  }

  private addPlayerSignInteraction() {
    const sign = this.tilemap.findObject(
      TilemapLayer.Objects,
      ({ name }) => name === TilemapObject.Sign,
    )!;

    this.sign = this.physics.add.staticBody(
      sign.x!,
      sign.y!,
      sign.width,
      sign.height,
    );
    this.sign.text = sign.properties[0].value;

    type ArcadeColliderType = Phaser.Types.Physics.Arcade.ArcadeColliderType;

    this.physics.add.overlap(
      this.sign as unknown as ArcadeColliderType,
      this.player.selector as unknown as ArcadeColliderType,
      (sign) => {
        if (this.player.cursors.space.isDown && !state.isTypewriting) {
          state.isTypewriting = true;

          render(
            <Typewriter
              text={(sign as unknown as Sign).text!}
              onEnd={() => (state.isTypewriting = false)}
            />,
            this,
          );
        }
      },
      undefined,
      this,
    );
  }

  update() {
    this.player.update();
    //console.log(this.scene.manager.scenes);

    for(let i=0; i<this.player.getPromptUtils().length; i++) {
      if(i<3){
        this.promptTexts[i].setText("Util "+i);
      }
    }


  }
}
