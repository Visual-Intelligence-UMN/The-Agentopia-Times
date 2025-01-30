import { useRef, useScene } from 'phaser-jsx';

interface Props {
  onEnter?: (text: string) => void;
}

export function TextInput(props: Props) {
  const scene = useScene();
  const ref = useRef<Phaser.GameObjects.Text>();
  let text = '';

  // 监听键盘输入
  scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' && text.length > 0) {
      props.onEnter?.(text); // 触发回调
      text = ''; // 清空输入
      ref.current!.setText('|'); // 显示光标
    } else if (event.key === 'Backspace') {
      text = text.slice(0, -1);
    } else if (event.key.length === 1) {
      text += event.key;
    }
    ref.current!.setText(text + '|'); // 更新显示
  });

  return (
    <text
      x={200}
      y={300}
      children="|"
      style={{ fontSize: '24px', color: '#fff' }}
      ref={(instance) => {
        if (instance) {
          ref.current = instance as unknown as Phaser.GameObjects.Text;
        }
      }}
    />
  );
}
