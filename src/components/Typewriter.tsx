import type Phaser from 'phaser';
import { useScene } from 'phaser-jsx';

import { Depth } from '../constants';

interface Props {
  text: string;
  onEnd?: () => void;
}

/**
 * Typewriter that supports automatic line wrapping when text exceeds the window width.
 */
export function Typewriter(props: Props) {
  const scene = useScene();
  let index = 0;
  let displayText = '';

  const maxWidth = scene.scale.width - 64;
  const paddingX = 18;
  const paddingY = 16;
  const textX = 16 + paddingX;
  const textY = 16 + paddingY;

  const background = scene.add
    .rectangle(16, 16, maxWidth + paddingX * 2, 42, 0xf5f0cf, 0.98)
    .setOrigin(0, 0)
    .setStrokeStyle(3, 0x1f1a12)
    .setScrollFactor(0)
    .setDepth(Depth.AboveWorld);

  const text = scene.add
    .bitmapText(textX, textY, 'minogram', '', 20)
    .setMaxWidth(maxWidth)
    .setTint(0x1a1a1a)
    .setScrollFactor(0)
    .setDepth(Depth.AboveWorld + 1);

  const syncBackground = () => {
    const width = Math.min(maxWidth + paddingX * 2, Math.max(text.width + paddingX * 2, 220));
    const height = Math.max(text.height + paddingY * 2, 56);
    background.setSize(width, height);
  };

  syncBackground();

  const timer = scene.time.addEvent({
    callback() {
      displayText += props.text[index];
      text.setText(displayText);
      syncBackground();
      index++;

      if (index >= props.text.length) {
        removeTimer(timer, scene);

        const oneshot = scene.time.delayedCall(1500, () => {
          text.destroy();
          background.destroy();
          removeTimer(oneshot, scene);
          if (typeof props.onEnd === 'function') {
            props.onEnd();
          }
        });
      }
    },

    delay: 100,
    repeat: props.text.length - 1,
  });

  return null;
}

function removeTimer(timer: Phaser.Time.TimerEvent, scene: Phaser.Scene) {
  timer.destroy();
  scene.time.removeEvent(timer);
}
