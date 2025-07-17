// import { Widget } from '@lumino/widgets';
import { useState } from 'react';

import { ReactWidget } from '@jupyterlab/apputils';
import '../style/index.css';

export interface JupytutorProps {}

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const [inputValue, setInputValue] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');

  const handleSubmit = () => {
    setSubmittedValue(inputValue);
    console.log('User submitted from React component:', inputValue);
  };

  const options: TailoredOptionProps[] = [
    { id: 'error', text: 'Why this error?' },
    { id: 'source', text: 'What should I review?' },
    { id: 'progress', text: 'What progress have I made?' }
  ];

  return (
    // Note we can use the same CSS classes from Method 1
    <div className="jupytutor">
      <TailoredOptions options={options} />
      <input
        id="jupytutor"
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        placeholder="Your text here..."
      />
      <button onClick={handleSubmit}>Submit</button>
      {submittedValue && <p id="jupytutor">You entered: {submittedValue}</p>}
    </div>
  );
};

interface TailoredOptionsProps {
  options: TailoredOptionProps[];
}

const TailoredOptions = (props: TailoredOptionsProps): JSX.Element => {
  return (
    <div className="tailoredOptionsContainer">
      {props.options.map((item, index) => (
        <TailoredOption {...item} key={item.id} />
      ))}
    </div>
  );
};

interface TailoredOptionProps {
  id: string;
  text: string;
}

const TailoredOption = (props: TailoredOptionProps): JSX.Element => {
  return (
    <div className="tailoredOption">
      <h4>{props.text}</h4>
    </div>
  );
};

/**
 * Returns a widget that comprises the Jupytutor interface.
 */
// const jupytutorWidget = () => {
//   const uiElement = new Widget();
//   uiElement.node.innerHTML = `
//         <div class="jupytutor-container" style="background-color: #f0f0f0; padding: 10px; border: 1px solid #ccc; margin-top: 5px;">
//           <label for="jupytutor-input">Enter some text:</label>
//           <input type="text" id="jupytutor-input" placeholder="Your text here..."/>
//           <button id="jupytutor-button">Submit</button>
//           <p id="jupytutor-output" style="margin-top: 5px;"></p>
//         </div>
//       `;

//   // --- CRUCIAL STEP: Find elements and attach event listeners ---
//   // We must do this *after* setting innerHTML.
//   const inputElement = uiElement.node.querySelector(
//     '#jupytutor-input'
//   ) as HTMLInputElement;
//   const buttonElement = uiElement.node.querySelector('#jupytutor-button');
//   const outputElement = uiElement.node.querySelector('#jupytutor-output');

//   if (buttonElement && inputElement && outputElement) {
//     // Add a click listener to the button.
//     buttonElement.addEventListener('click', () => {
//       // Access the value from the input element.
//       const userInput = inputElement.value;

//       // Do something with the input, e.g., display it or log it.
//       console.log('User entered:', userInput);
//       outputElement.textContent = `You entered: ${userInput}`;

//       // You could also send this data to the kernel, etc.
//     });
//   }

//   return uiElement;
// };

class JupytutorWidget extends ReactWidget {
  private readonly props: JupytutorProps;
  constructor(props: JupytutorProps = {}) {
    super();
    this.props = props;
    this.addClass('jp-ReactWidget'); // For styling
  }

  render(): JSX.Element {
    return <Jupytutor {...this.props} />;
  }
}

export default JupytutorWidget;
