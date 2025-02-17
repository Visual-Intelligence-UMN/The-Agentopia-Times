// import Phaser from 'phaser';
// import { Rectangle, render } from 'phaser-jsx';

// import { Button, TilemapDebug, Typewriter } from '../components';
// import {
//   Depth,
//   key,
//   TilemapLayer,
//   TilemapObject,
//   TILESET_NAME,
// } from '../constants';
// import { Player } from '../sprites';
// import { state } from '../state';
// import { NPC } from '../sprites/NPC';
// import { Agent } from '../sprites/Agent';
// import { fetchChatCompletion } from '../server/server';
// import * as ts from 'typescript';
// import { controlAgentMovements, initKeyboardInputs } from '../utils/controlUtils';

// interface Sign {
//   text: string;
// }
// import { setupKeyListeners } from '../utils/controlUtils';
// import { AgentPerspectiveKeyMapping } from '../utils/controlUtils';
// import { addAgentPanelHUD, addAgentSelectionMenuHUD, addSceneNameHUD } from '../utils/hudUtils';
// import { createItem } from '../utils/sceneUtils';
// import { debateWithJudging } from '../server/simulations/debate';




// export function addPlayerSignInteraction(
//     this: any
// ) {
//     const sign = this.tilemap.findObject(
//       TilemapLayer.Objects,
//       (obj: { name: string }) => obj.name === TilemapObject.Sign,
//     )!;

//     this.sign = this.physics.add.staticBody(
//       sign.x!,
//       sign.y!,
//       sign.width,
//       sign.height,
//     );
//     this.sign.text = sign.properties[0].value;

//     type ArcadeColliderType = Phaser.Types.Physics.Arcade.ArcadeColliderType;

//     this.physics.add.overlap(
//       this.sign as unknown as ArcadeColliderType,
//       this.player.selector as unknown as ArcadeColliderType,
//       (sign: any) => {
//         if (this.player.cursors.space.isDown && !state.isTypewriting) {
//           state.isTypewriting = true;

//           render(
//             <Typewriter
//               text={(sign as unknown as Sign).text!}
//               onEnd={() => (state.isTypewriting = false)}
//             />,
//             this,
//           );
//         }
//       },
//       undefined,
//       this,
//     );
// }
