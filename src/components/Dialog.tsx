import { Text, useRef, useScene, Container } from 'phaser-jsx';
import { Depth } from '../constants';

// Verify OpenAI API Key
const verifyApiKey = async (apiKey: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // If the response status is 200, the key is valid.
    return response.ok;
  } catch (error) {
    // console.error('Error verifying API key:', error);
    return false;
  }
};

interface Props {
  text: string;
  isInputLocked: boolean;  // Receive isInputLocked as props
  setIsInputLocked: (locked: boolean) => void;  // Receive a method for updating the isInputLocked
  onEnd?: () => void;  // Callback to notify parent that Dialog should disappear
}

export function Dialog(props: Props) {
  const scene = useScene();
  const containerRef = useRef<Phaser.GameObjects.Container>();
  const textRef = useRef<Phaser.GameObjects.Text>();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null); // Reference for the button
  const maxWidth = scene.scale.width - 40;

  const unlockPlayerControl = async () => {
    // Get the API key entered by the user
    const apiKey = inputRef.current?.value.trim();
    if (apiKey) {
      // Save the API key to localStorage
      localStorage.setItem('openai-api-key', apiKey);
      // console.log('API Key saved to localStorage:', apiKey);

      // Verify that the API key is valid
      const isValid = await verifyApiKey(apiKey);
      if (isValid) {
        // If the key is valid, unlock it
        props.setIsInputLocked(false);  // Call the incoming setIsInputLocked to update the state of the master page.
        // console.log('Input submitted! Player can now control the game.');

        // Notify parent that Dialog should disappear
        if (props.onEnd) {
          props.onEnd();
        }
      } else {
        // If the key is invalid, keep it locked
        // console.log('Invalid API key, player is still locked.');
        props.setIsInputLocked(true);  // Keep it locked.
      }
    } else {
      // console.log('No API key provided.');
    }
  };

  const setupText = () => {
    // Set text for the dialog
    if (textRef.current) {
      textRef.current.setText(props.text);
    }

    // Create the input element if it doesn't exist yet
    if (inputRef.current === null) {
      inputRef.current = document.createElement('input');
      inputRef.current.type = 'text';
      inputRef.current.placeholder = 'Enter OpenAI API Key';
      inputRef.current.style.fontSize = '16px';
      inputRef.current.style.border = '2px solid #ffffff';
      inputRef.current.style.color = '#111';
      inputRef.current.style.backgroundColor = '#00011';
      inputRef.current.style.padding = '5px';
      inputRef.current.style.position = 'absolute'; // We want to control its position in the UI

      document.body.appendChild(inputRef.current);

      // Set initial position for the input box below the text area
      inputRef.current.style.top = `${60 + 10 + (textRef.current?.height || 40)}px`;
      inputRef.current.style.left = `${0 + 225}px`;

      // Input listener to capture changes
      inputRef.current.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        // console.log('Current input:', value);
      });
    }

    // Create the button element if it doesn't exist yet
    if (buttonRef.current === null) {
      buttonRef.current = document.createElement('button');
      buttonRef.current.textContent = 'Submit'; // Button label
      buttonRef.current.style.fontSize = '16px';
      buttonRef.current.style.padding = '10px';
      buttonRef.current.style.border = '2px solid #ffffff';
      buttonRef.current.style.backgroundColor = '#4CAF50'; // Green button
      buttonRef.current.style.color = '#fff';
      buttonRef.current.style.position = 'absolute'; // We want to control its position in the UI

      document.body.appendChild(buttonRef.current);

      // Position button to the right of the input box
      buttonRef.current.style.top = `${60 + 10 + (textRef.current?.height || 40) + 40}px`; // Below the input
      buttonRef.current.style.left = `${0 + 12 + 215}px`; // Adjusted left position to align beside the input

      // Button click listener
      buttonRef.current.addEventListener('click', () => {
        // When the button is clicked, we call the unlockPlayerControl function
        unlockPlayerControl();
      });
    }
  };

  // Set up text and input when the scene is created
  scene.events.once('create', setupText);

  // Update the dialog text if necessary
  scene.events.on('update', () => {
    if (textRef.current && textRef.current.text !== props.text) {
      textRef.current.setText(props.text);
      // Adjust input position if the text changes and its height might change
      if (inputRef.current) {
        inputRef.current.style.top = `${60 + 40 + (textRef.current?.height || 40)}px`;
      }

      // Adjust button position if necessary
      if (buttonRef.current) {
        buttonRef.current.style.top = `${60 + 50 + (textRef.current?.height || 40) + 40}px`;
      }
    }
  });

  return (
    <Container
      x={16}
      y={60}
      ref={containerRef}
    >
      <Text
        x={0}
        y={0}
        style={{
          backgroundColor: '#98b0d8',
          color: '#000',
          font: '18px monospace',
          padding: { x: 20, y: 10 },
          wordWrap: { width: maxWidth, useAdvancedWrap: true },
        }}
        alpha={0.80}
        scrollFactorX={0}
        scrollFactorY={0}
        depth={Depth.AboveWorld}
        ref={textRef}
      />
      {/* The input element is handled via DOMElement */}
    </Container>
  );
}