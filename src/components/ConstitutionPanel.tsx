import React, { useState } from "react";
import Draggable from "react-draggable";

interface ConstitutionPanelProps {
  onClose: () => void;
  onSelectConstitution: (constitution: string) => void; // called when player selects a constitution
}

const AGENTS = ["The Dictator", "The Revolutionary", "The Technocrat"];

const PROPOSALS: Record<string, string[]> = {
  "The Dictator": [
    "A. Impose strict wealth ceiling. All assets above 1000 are seized.",
    "B. Surveillance on all trade to prevent rebellion.",
    "C. Centralize all economic decisions under the Governor's Office.",
  ],
  "The Revolutionary": [
    "A. Nationalize key industries and redistribute profits.",
    "B. Create citizen councils to propose new laws.",
    "C. Abolish private land ownership.",
  ],
  "The Technocrat": [
    "A. Optimize taxation dynamically based on economic indicators.",
    "B. Introduce automated audits to ensure fairness.",
    "C. Launch data-driven unemployment mitigation programs.",
  ],
};

const ConstitutionPanel: React.FC<ConstitutionPanelProps> = ({
  onClose,
  onSelectConstitution,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    onSelectConstitution(option); // fire to parent
    onClose(); // close panel
  };

  return (
    <Draggable handle=".window-header" defaultPosition={{ x: 0, y: 0 }}>
      <div className="window">
        <div className="window-header">
          <span>Governors</span>
          <button onClick={onClose}>✖</button>
        </div>

        <div className="window-content" style={{ color: "black" }}>
          {!selectedAgent ? (
            <>
              <p>Select a Governor:</p>
              {AGENTS.map((agent) => (
                <button
                  key={agent}
                  style={{ display: "block", margin: "4px 0" }}
                  onClick={() => setSelectedAgent(agent)}
                >
                  {agent}
                </button>
              ))}
            </>
          ) : (
            <>
              <p>
                <strong>{selectedAgent}</strong>'s Constitution Proposals:
              </p>
              {PROPOSALS[selectedAgent].map((proposal, index) => (
                <button
                  key={index}
                  style={{ display: "block", margin: "4px 0", textAlign: "left" }}
                  onClick={() => handleSelect(proposal)}
                >
                  {proposal}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </Draggable>
  );
};

export default ConstitutionPanel;
