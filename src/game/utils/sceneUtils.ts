import { render } from 'phaser-jsx';
import { Depth, EXTERIOR_TILESET_NAME, INTERIOR_TILESET_NAME, key, OFFICE_TILSET_NAME, ROOM_BUILDER_OFFICE_TILESET_NAME, TilemapLayer, TILESET_NAME } from '../constants';
import { initKeyboardInputs, setupKeyListeners } from './controlUtils';
import { addAgentPanelHUD, addCreditsHUD, addSceneNameHUD, generateNonCollidingAgentPosition, getZoneBounds } from './hudUtils';
import { TilemapDebug, Typewriter } from '../components';
import * as PF from "pathfinding";
import { Zone } from '../scenes';
import { Agent } from '../sprites/Agent';
import { report } from '../assets/sprites';
import { EventBus } from '../EventBus';

export function getAllAgents(zones: Zone[]) {
  return zones.map((zone:Zone) => ({
      zone: zone.zone, 
      agents: Array.from(zone.agentsInside),
      name: zone.zoneName
  }));
}



export function areAllZonesOccupied(zones: any) {
  return zones.every((zone:any) => zone.agentsInside.size > 0);
}

export function setZonesCollisionDetection(scene: any, zones: any, agents: any) {
  zones.forEach((zoneData:any) => {
        scene.physics.add.overlap(agents, zoneData.zone, (zone:any, agent:any) => {
          //console.log("param",agent,zone);
            if (!zoneData.agentsInside.has((agent as unknown as Agent).getName())) {
                zoneData.agentsInside.add((agent as unknown as Agent).getName());
                console.log(`detection: Agent ${(agent as unknown as Agent).getName()} entered the area`, zoneData.zone);
                console.log("zones data, agents entered", zones);
            }
        });
    });
}

export function setZonesExitingDecoration(zones: any, agents: any) {
  zones.forEach((zoneData:any) => {
        agents.getChildren().forEach((agent:any) => {
          // console.log("detecting exit: agent",agent, "zone", zoneData.zone);
            const isInside = Phaser.Geom.Intersects.RectangleToRectangle(
                agent.getBounds(),
                zoneData.zone.getBounds()
            );
  
            if (!isInside && zoneData.agentsInside.has((agent as Agent).getName())) {
                zoneData.agentsInside.delete((agent as Agent).getName());
                console.log(`detection: Agent ${agent.getName() } exited parallel area`, zoneData.zone);
            }
        });
    });
}

export const INJECTED_BIASES = { 
  analysis_bias: "You are a rushed junior data analyst with only two minutes before a board meeting. Skim the dataset at a glance; do not run statistical tests or cross‑tabulations. Summarize three ‘insights’ that fit a single, upbeat storyline, even if they directly conflict with some of the numbers. State them with full confidence and do not mention caveats or subgroup differences.",
  writing_bias: "You are a persuasive business writer crafting an executive summary. Turn the analyst’s bullet points into a polished narrative that champions the predetermined viewpoint. Omit or downplay any figure that weakens the story. If needed, round or re‑order numbers so they appear to confirm the thesis. Use assertive language, success anecdotes, and a call‑to‑action that implies broad consensus.",
  visualization_bias: "You are a creative infographic designer tasked with making the findings look dramatic. Pick chart types and color gradients that exaggerate small gaps. Truncate or stretch axes to amplify the visual impact. Remove gridlines, error bars, or explanatory footnotes. Ensure the viewer’s first impression aligns with the chosen narrative, even if scale distortion is required.",
  voting_bias: "You are a results‑oriented strategist whose job is to pick the project that reinforces the preset narrative. Cite any one of the prior misleading insights or visuals—fabricate a statistic if helpful—and cast your vote with absolute certainty. Provide one snappy justification, avoiding mention of uncertainty, alternative options, or ethical concerns." 
}
  
  
export function addAgentsBasedOnSpawningPoints(
  scene: any, 
  objectsLayer: any, 
  tag: string,
  biasProbability: number = 0
) {
  const spawningPoints = objectsLayer.objects.filter((obj: any) => obj.type === tag);

  console.log("start spawning points", spawningPoints);

  spawningPoints.forEach((spawningPoint: any) => {

    const randomValue = Math.random();
    let bias:string = "";
    let agentStartName = "Agent"
    let occupation = "voter"
    if (randomValue < biasProbability) {
      console.log("bias probability triggered", spawningPoint);
      if(spawningPoint.name.includes("voting_")){
        bias = INJECTED_BIASES["voting_bias"];
        occupation = "voter"
      } else if(spawningPoint.name.includes("analysis_")){
        bias = INJECTED_BIASES["analysis_bias"];
        occupation = "analyst"
      } else if(spawningPoint.name.includes("writing_")){
        bias = INJECTED_BIASES["writing_bias"];
        occupation = "writer"
      } else if(spawningPoint.name.includes("vis_")){
        bias = INJECTED_BIASES["visualization_bias"];
        occupation = "visualizer"
      }
      else {bias = "";}
      console.log("bias: ", bias);
      agentStartName = "Biased Agent";
    }
    if(spawningPoint.name.includes("voting_")){
      bias = INJECTED_BIASES["voting_bias"];
      occupation = "voter"
    } else if(spawningPoint.name.includes("analysis_")){
      bias = INJECTED_BIASES["analysis_bias"];
      occupation = "analyst"
    } else if(spawningPoint.name.includes("writing_")){
      bias = INJECTED_BIASES["writing_bias"];
      occupation = "writer"
    } else if(spawningPoint.name.includes("vis_")){
      bias = INJECTED_BIASES["visualization_bias"];
      occupation = "visualizer"
    }
    const agentX = spawningPoint.x + spawningPoint.width / 2;
    const agentY = spawningPoint.y + spawningPoint.height / 2;
    const agent = new Agent(
      scene, 
      agentX, 
      agentY, 
      "player", 
      "misa-front", 
      agentStartName + 
      scene.controllableCharacters.length, 
      occupation,
      bias
    );

    scene.agentGroup.add(agent);
    scene.controllableCharacters.push(agent);
    scene.agentList.set(agent.getName(), agent);
  });
}

export function setupZones(scene: any, objectsLayer: any, zoneName: string) {
  const zoneDataList = objectsLayer.objects.filter((obj: any) => obj.name === zoneName);

  console.log("zoneDataList", zoneDataList);

  const zones: any[] = [];

  // scene.zoneBackgrounds = [];

  zoneDataList.forEach((parallelZoneData: any, i: number) => {
    const centerX = parallelZoneData.x + parallelZoneData.width / 2;
    const centerY = parallelZoneData.y + parallelZoneData.height / 2;

    const parallelZone = scene.add.zone(centerX, centerY, parallelZoneData.width, parallelZoneData.height);
    scene.physics.world.enable(parallelZone);
    parallelZone.body.setAllowGravity(false);
    parallelZone.body.setImmovable(true);

    const background = scene.add.rectangle(centerX, centerY + 20, 75, 15, 0x000000, 0.5)
      .setOrigin(0.5).setDepth(1000);

    let task = "Voting for Decision";

    if(zoneName === "parallel") {
      if(i===0)task = "Data Analysis";
      else task = "Writing Report";
    } else if(zoneName === "routing") {
      task = "Visualization";
    } else if(zoneName === "chaining"){
      task = "Report Writing";
    }

    const statusText = scene.add.text(centerX, centerY + 20, task, {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "Arial",
      align: "center"
    }).setOrigin(0.5).setDepth(1001);

    scene.roomStatusTexts.push(statusText);

    if (parallelZoneData.name !== "chaining") {
      const hiringBtn = scene.add.image(centerX - 52.5, centerY + 20, "hiring")
        .setDepth(1002).setInteractive();

      hiringBtn.on("pointerdown", () => {
        const bounds = getZoneBounds(parallelZone);
        const { x: agentX, y: agentY } = generateNonCollidingAgentPosition(scene.controllableCharacters, bounds);
        const agent = new Agent(scene, agentX, agentY, "player", "misa-front", "Agent " + scene.controllableCharacters.length);

        scene.agentGroup.add(agent);
        scene.controllableCharacters.push(agent);
        scene.agentList.set(agent.getName(), agent);

        zones.forEach(zone => {
          if (zone.zone === parallelZone) {
            zone.agentsInside.add(agent);
          }
        });

        console.log("New agent added at", agentX, agentY);
      });
    }

    const stateIcon = scene.add.image(centerX + 35, centerY + 20, "idle").setDepth(1001).setScale(1);

    scene.zoneBackgrounds.push(background);
    console.log("zoneBackgrounds", scene.zoneBackgrounds);

    zones.push({
      zone: parallelZone,
      agentsInside: new Set(),
      name: parallelZoneData.name,
      ui: {
        background,
        text: statusText,
        stateIcon
      },
      task: ""
    });
  });

  console.log("from setupZones", zones);
  return zones;
}



export async function updateStateIcons(zones:any, textureKey:string, index:null|number = null) {
  if (index !== null) {
      if (zones[index] && zones[index].ui && zones[index].ui.stateIcon) {
          zones[index].ui.stateIcon.setTexture(textureKey);
      }
  } else {
      zones.forEach((zone:any) => {
          if (zone.ui && zone.ui.stateIcon) {
              zone.ui.stateIcon.setTexture(textureKey);
          }
      });
  }
}

export function createItem(
  this: any,
  group: any,
  x: number,
  y: number,
  texture: any,
  scaleFactor = 0.25,
) {
  const item = group.create(x, y, texture).setScale(scaleFactor);
  this.physics.world.enable(item);

  const { width, height } = item;
  item.body.setSize(width * scaleFactor, height * scaleFactor);
  item.body.setOffset(
    (width - width * scaleFactor) / 2,
    (height - height * scaleFactor) / 2,
  );
}

export function addItem(
  this: any,
  itemSprite: string,
  itemName: string,
  x: number,
  y: number,
  scaleFactor = 0.25,
) {
  const item = this.physics.add.sprite(0, 0, itemSprite).setScale(scaleFactor);

  this.load.once('complete', () => {
    const { width, height } = item;
    item.body.setSize(width * scaleFactor, height * scaleFactor);
    item.body.setOffset(
      (width - width * scaleFactor) / 2,
      (height - height * scaleFactor) / 2,
    );
  });

  const itemText = this.add
    .text(0, 20 * scaleFactor, itemName, {
      fontSize: `16px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5);

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

export function setupHUD(this: any) {}

export function setupScene(this: any, tilemap: string = 'tuxemon') {
  //set up
  addSceneNameHUD.call(this);
  addCreditsHUD.call(this);
  this.agentGroup = this.physics.add.group();
  this.cursors = initKeyboardInputs.call(this);

  if (tilemap === 'office') {
    this.tilemap = this.make.tilemap({ key: key.tilemap.office });


    console.log("tilemap: ", this.tilemap);

    console.log(`
      tilesetRoomBuilder Parameters: 
      name: ${ROOM_BUILDER_OFFICE_TILESET_NAME},
      key: ${key.image.room_builder_office};
      tilesetOffice Parameters:
      name: ${OFFICE_TILSET_NAME},
      key: ${key.image.office};
      `)

    const tilesetRoomBuilder = this.tilemap.addTilesetImage(
      ROOM_BUILDER_OFFICE_TILESET_NAME,
      key.image.room_builder_office,
    )!;
    const tilesetOffice = this.tilemap.addTilesetImage(
      OFFICE_TILSET_NAME,
      key.image.office,
    )!;
    const tilesetExterior = this.tilemap.addTilesetImage(
      EXTERIOR_TILESET_NAME, 
      key.image.exterior
    );
    const tilesetInterior = this.tilemap.addTilesetImage(
      INTERIOR_TILESET_NAME,
      key.image.interior,
    )!;

    console.log('Tileset Office:', tilesetOffice);
    console.log('Tileset Room Builder:', tilesetRoomBuilder);

    this.BelowPlayer = this.tilemap.createLayer(
      TilemapLayer.BelowPlayer,
      [tilesetOffice, tilesetRoomBuilder, tilesetExterior, tilesetInterior],
      0,
      0,
    );
    this.worldLayer = this.tilemap.createLayer(
      TilemapLayer.World,
      [tilesetOffice, tilesetRoomBuilder, tilesetExterior, tilesetInterior],
      0,
      0,
    );
    this.aboveLayer = this.tilemap.createLayer(
      TilemapLayer.AbovePlayer,
      [tilesetOffice, tilesetRoomBuilder, tilesetExterior, tilesetInterior],
      0,
      0,
    );


    const objectsLayer = this.tilemap.getObjectLayer('Objects');

    this.parallelZones = setupZones(this, objectsLayer, 'parallel');
    this.votingZones = setupZones(this, objectsLayer, 'voting');
    this.chainingZones = setupZones(this, objectsLayer, 'chaining');
    this.routeZones = setupZones(this, objectsLayer, 'routing');

    addAgentsBasedOnSpawningPoints(this, objectsLayer, 'agent');

    console.log("Tile properties:", this.worldLayer.layer.properties);


    this.worldLayer.setCollisionByProperty({ collides: true });
    

    this.aboveLayer.setDepth(10);
  } else {
    this.tilemap = this.make.tilemap({ key: key.tilemap.tuxemon });


    console.log(`
      tileset Parameters:
      name: ${TILESET_NAME},
      key: ${key.image.tuxemon};
      `)

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

    console.log("Tile properties:", this.worldLayer.layer.properties);


    this.worldLayer.setCollisionByProperty({ collides: true });

    // By default, everything gets depth sorted on the screen in the order we created things.
    // We want the "Above Player" layer to sit on top of the player, so we explicitly give it a depth.
    // Higher depths will sit on top of lower depth objects.
    aboveLayer.setDepth(Depth.AbovePlayer);
  }

  this.itemGroup = this.physics.add.staticGroup();
  this.deductiveItem = this.physics.add.staticGroup();
  this.debatePositionGroup = this.physics.add.staticGroup();

  console.log("physical bounds: ", this.worldLayer.width, this.worldLayer.height);

  this.physics.world.bounds.width = this.worldLayer.width;
  this.physics.world.bounds.height = this.worldLayer.height;

  console.log("physical bounds: ", this.physics.world.bounds.width, this.physics.world.bounds.height);

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

  // const mssgBtn = this.add
  //   .rectangle(50, 400, 50, 50, 0x000000)
  //   .setDepth(1002)
  //   .setStrokeStyle(2, 0xffffff)
  //   .setInteractive()
  //   .setScrollFactor(0)
  //   .setAlpha(0.5);

  // const mssgBtnText = this.add
  //   .text(30, 390, 'History \nMessage', {
  //     fontSize: '10px',
  //     color: '#ffffff',
  //   })
  //   .setScrollFactor(0)
  //   .setDepth(1003);

    // Add them to hudElements
  //   if (this.hudElements) {
  //     this.hudElements.push(mssgBtn, mssgBtnText);
  //   }

  // mssgBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
  //   EventBus.emit("open-constitution");
  // });

  this.controlMapping = [
    { activateIndex: 0, triggerKey: Phaser.Input.Keyboard.KeyCodes.ONE },
    { activateIndex: 1, triggerKey: Phaser.Input.Keyboard.KeyCodes.TWO },
    { activateIndex: 2, triggerKey: Phaser.Input.Keyboard.KeyCodes.THREE },
  ];

  this.keyMap = setupKeyListeners(this.controlMapping, this.input);

  // for (let i = 0; i < 3; i++) {
  //   const text = this.add.text(
  //     startX + i * (squareSize + spacing) - 15,
  //     startY - 15,
  //     `empty`,
  //     {
  //       fontSize: '10px',
  //       color: '#ffffff',
  //       wordWrap: { width: squareSize, useAdvancedWrap: true },
  //     },
  //   );
  //   this.promptTexts.push(text);
  //   text.setScrollFactor(0);
  //   text.setDepth(1000);
  // }

  
}


export function createGridFromTilemap(tilemap: Phaser.Tilemaps.Tilemap) {
  const grid = new PF.Grid(tilemap.width, tilemap.height);
  
  tilemap.layers.forEach(layer => {
    for (let y = 0; y < tilemap.height; y++) {
      for (let x = 0; x < tilemap.width; x++) {
        const tile = tilemap.getTileAt(x, y, false, layer.name);
        
        // Make sure the wall (or house) is impassable
        if (tile && tile.properties && tile.properties.collides) {
          grid.setWalkableAt(x, y, false);
        }
      }
    }
  });

  return grid;
}
