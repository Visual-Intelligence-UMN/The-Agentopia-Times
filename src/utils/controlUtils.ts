import * as PF from "pathfinding";
import { Velocity } from '../sprites';
import { Animation } from '../sprites';
import { key } from '../constants';
import {createGridFromTilemap} from './sceneUtils'

export function controlAgentMovements(
  playerControlledAgent: any,
  cursors: any,
) {
  // agent movement controls
  const { anims, body } = playerControlledAgent;
  const prevVelocity = body.velocity.clone();

  // Stop any previous movement from the last frame
  body.setVelocity(0);

  // Horizontal movement
  switch (true) {
    case cursors.left.isDown:
    case cursors.a.isDown:
      body.setVelocityX(-Velocity.Horizontal);
      break;

    case cursors.right.isDown:
    case cursors.d.isDown:
      body.setVelocityX(Velocity.Horizontal);
      break;
  }

  // Vertical movement
  switch (true) {
    case cursors.up.isDown:
    case cursors.w.isDown:
      body.setVelocityY(-Velocity.Vertical);
      break;

    case cursors.down.isDown:
    case cursors.s.isDown:
      body.setVelocityY(Velocity.Vertical);
      break;
  }

  // Normalize and scale the velocity so that player can't move faster along a diagonal
  body.velocity.normalize().scale(Velocity.Horizontal);

  // Update the animation last and give left/right animations precedence over up/down animations
  switch (true) {
    case cursors.left.isDown:
    case cursors.a.isDown:
      anims.play(Animation.Left, true);
      playerControlledAgent.moveSelector(Animation.Left);
      break;

    case cursors.right.isDown:
    case cursors.d.isDown:
      anims.play(Animation.Right, true);
      playerControlledAgent.moveSelector(Animation.Right);
      break;

    case cursors.up.isDown:
    case cursors.w.isDown:
      anims.play(Animation.Up, true);
      playerControlledAgent.moveSelector(Animation.Up);
      break;

    case cursors.down.isDown:
    case cursors.s.isDown:
      anims.play(Animation.Down, true);
      playerControlledAgent.moveSelector(Animation.Down);
      break;

    default:
      anims.stop();

      // If we were moving, pick an idle frame to use
      switch (true) {
        case prevVelocity.x < 0:
          playerControlledAgent.setTexture(key.atlas.player, 'misa-left');
          playerControlledAgent.moveSelector(Animation.Left);
          break;

        case prevVelocity.x > 0:
          playerControlledAgent.setTexture(key.atlas.player, 'misa-right');
          playerControlledAgent.moveSelector(Animation.Right);
          break;

        case prevVelocity.y < 0:
          playerControlledAgent.setTexture(key.atlas.player, 'misa-back');
          playerControlledAgent.moveSelector(Animation.Up);
          break;

        case prevVelocity.y > 0:
          playerControlledAgent.setTexture(key.atlas.player, 'misa-front');
          playerControlledAgent.moveSelector(Animation.Down);
          break;
      }
  }
}

export interface AgentPerspectiveKeyMapping{
    activateIndex: number;
    triggerKey: any;
}

export function setupKeyListeners(
    controlMapping: AgentPerspectiveKeyMapping[], 
    input: Phaser.Input.InputPlugin
): Map<number, Phaser.Input.Keyboard.Key> {
    const keyMap = new Map<number, Phaser.Input.Keyboard.Key>();
    controlMapping.forEach(mapping => {
        keyMap.set(mapping.triggerKey, input.keyboard!.addKey(mapping.triggerKey));
    });
    return keyMap;
}

export function controlPlayerPerspective(
    controlMapping: AgentPerspectiveKeyMapping[], 
    cameras: any,
    controllableCharacters: any,
    input: any
){
    controlMapping.forEach((mapping: AgentPerspectiveKeyMapping) => {
        updatePlayerPerspective(cameras, controllableCharacters, mapping.activateIndex, input, mapping.triggerKey);
    });
}

function updatePlayerPerspective(
    cameras: any, 
    controllableCharacters: any, 
    activateIndex: number, 
    input: any, 
    triggerKey:any
) {
    if (input.keyboard!.checkDown(input.keyboard!.addKey(triggerKey), 250)) {
        cameras.main.startFollow(controllableCharacters[activateIndex]); 
        controllableCharacters.forEach((agent: any) => {
        agent.changeNameTagColor("#ffffff");
        })
        controllableCharacters[activateIndex].changeNameTagColor("#ff0000");
    }
}

export function initKeyboardInputs(this: any){
  return (this.input.keyboard
        ? this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            w: Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            one: Phaser.Input.Keyboard.KeyCodes.ONE,
            seven: Phaser.Input.Keyboard.KeyCodes.SEVEN,
            eight: Phaser.Input.Keyboard.KeyCodes.EIGHT,
            nine: Phaser.Input.Keyboard.KeyCodes.NINE,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
          })
        : null);
}


/* 

Control Agents With Mouse

*/ 

let cachedGrid: PF.Grid | null = null;
let pathGraphics: Phaser.GameObjects.Graphics | null = null;
let targetCircle: Phaser.GameObjects.Graphics | null = null;

function createOrUpdateGrid(tilemap: Phaser.Tilemaps.Tilemap, forceUpdate = false) {
  if (!cachedGrid || forceUpdate) {
    cachedGrid = createGridFromTilemap(tilemap);
  }
  return cachedGrid;
}

export function controlAgentWithMouse(scene: Phaser.Scene, playerControlledAgent: any, tilemap: Phaser.Tilemaps.Tilemap) {
  const finder = new PF.AStarFinder();

  scene.input.off("pointerdown"); // Remove previously bound events first
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (scene.tweens.isTweening(playerControlledAgent)) {
      scene.tweens.killTweensOf(playerControlledAgent); // Stop current movement
    }

    const grid = createOrUpdateGrid(tilemap);
    const agentTileX = Math.floor(playerControlledAgent.x / tilemap.tileWidth);
    const agentTileY = Math.floor(playerControlledAgent.y / tilemap.tileHeight);
    const targetTileX = Math.floor(pointer.worldX / tilemap.tileWidth);
    const targetTileY = Math.floor(pointer.worldY / tilemap.tileHeight);

    let path = finder.findPath(agentTileX, agentTileY, targetTileX, targetTileY, grid.clone());

    if (path.length > 1) {
      path.shift();
    }

    // Create a circle for the target position
    createTargetCircle(scene, targetTileX, targetTileY, tilemap);

    // Drawing path dashed lines
    drawDashedPath(scene, path, tilemap);


    // console.log("controlAgentWithMouse")
    moveAlongPath(scene, playerControlledAgent, path, tilemap);
  });

  scene.events.on("mapUpdated", () => {
    // console.log("mapUpdated");
    scene.tweens.killTweensOf(playerControlledAgent);
    createOrUpdateGrid(tilemap, true);
  });
}

// Creating a circle of target points
function createTargetCircle(scene: Phaser.Scene, tileX: number, tileY: number, tilemap: Phaser.Tilemaps.Tilemap) {
  if (targetCircle) {
    targetCircle.destroy(); // Remove previous target circle
  }

  const targetX = tileX * tilemap.tileWidth + tilemap.tileWidth / 2;
  const targetY = tileY * tilemap.tileHeight + tilemap.tileHeight / 2;

  targetCircle = scene.add.graphics();
  targetCircle.lineStyle(4, 0xff0000, 1);
  targetCircle.strokeCircle(targetX, targetY, tilemap.tileWidth / 2);

  // Add blinking animation
  scene.tweens.add({
    targets: targetCircle,
    alpha: 0,
    duration: 500,
    yoyo: true,
    repeat: -1,
  });
}

// Drawing path dashed lines
function drawDashedPath(scene: Phaser.Scene, path: number[][], tilemap: Phaser.Tilemaps.Tilemap) {
  if (pathGraphics) {
    pathGraphics.clear(); // Clear the last path
  } else {
    pathGraphics = scene.add.graphics();
  }

  pathGraphics.lineStyle(2, 0x00ff00, 1);

  for (let i = 0; i < path.length - 1; i++) {
    const x1 = path[i][0] * tilemap.tileWidth + tilemap.tileWidth / 2;
    const y1 = path[i][1] * tilemap.tileHeight + tilemap.tileHeight / 2;
    const x2 = path[i + 1][0] * tilemap.tileWidth + tilemap.tileWidth / 2;
    const y2 = path[i + 1][1] * tilemap.tileHeight + tilemap.tileHeight / 2;

    drawDashedLine(pathGraphics, x1, y1, x2, y2, 10, 5); // 10px solid line + 5px spacing
  }
}

// Drawing single-segment dotted lines
function drawDashedLine(graphics: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dashLength: number, gapLength: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const dashCount = Math.floor(distance / (dashLength + gapLength));

  for (let i = 0; i < dashCount; i++) {
    const t1 = i / dashCount;
    const t2 = (i + 0.5) / dashCount;

    const startX = x1 + dx * t1;
    const startY = y1 + dy * t1;
    const endX = x1 + dx * t2;
    const endY = y1 + dy * t2;

    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
  }

  graphics.strokePath();
}

// Make the character move along the path and dynamically update the path dotted line
function moveAlongPath(scene: Phaser.Scene, agent: Phaser.GameObjects.Sprite, path: number[][], tilemap: Phaser.Tilemaps.Tilemap) {
  // console.log("moveAlongPath");

  if (!path || path.length === 0) {
    // console.log("Path is empty, stopping movement.");

    if (targetCircle) {
      targetCircle.destroy();
    }

    agent.anims.stop();

    return;
  }

  const nextPoint = path.shift();
  const targetX = nextPoint![0] * tilemap.tileWidth + tilemap.tileWidth / 2;
  const targetY = nextPoint![1] * tilemap.tileHeight + tilemap.tileHeight / 2;

  // Calculate the character's orientation and record it
  const dx = targetX - agent.x;
  const dy = targetY - agent.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      agent.anims.play(Animation.Right, true);
      agent.setTexture(key.atlas.player, 'misa-right');
    } else {
      agent.anims.play(Animation.Left, true);
      agent.setTexture(key.atlas.player, 'misa-left');
    }
  } else {
    if (dy > 0) {
      agent.anims.play(Animation.Down, true);
      agent.setTexture(key.atlas.player, 'misa-front');
    } else {
      agent.anims.play(Animation.Up, true);
      agent.setTexture(key.atlas.player, 'misa-back');
    }
  }

  scene.tweens.add({
    targets: agent,
    x: targetX,
    y: targetY,
    duration: 500,
    ease: "Linear",
    onComplete: () => {
      drawDashedPath(scene, path, tilemap);
      moveAlongPath(scene, agent, path, tilemap);
    },
  });
}