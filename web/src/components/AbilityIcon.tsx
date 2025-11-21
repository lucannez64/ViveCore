import React from 'react';
import { FaSnowflake, FaWind, FaFire, FaMagic, FaShieldAlt, FaFistRaised, FaHeartbeat, FaSkull, FaBolt, FaSun, FaQuestion } from 'react-icons/fa';
import { IconType } from 'react-icons';

interface AbilityIconProps {
  abilityName: string;
}

const AbilityIcon: React.FC<AbilityIconProps> = ({ abilityName }) => {
  const getIconAndColor = (): [IconType, string] => {
    const abilityLower = abilityName.toLowerCase();
    
    if (abilityLower.includes('cold') || abilityLower.includes('ice')) {
      return [FaSnowflake, "#87CEEB"];
    } else if (abilityLower.includes('ghost') || abilityLower.includes('walk')) {
      return [FaWind, "#F0F8FF"];
    } else if (abilityLower.includes('fire') || abilityLower.includes('burn')) {
      return [FaFire, "#FF4500"];
    } else if (abilityLower.includes('wall')) {
      return [FaShieldAlt, "#A9A9A9"];
    } else if (abilityLower.includes('hook')) {
      return [FaMagic, "#8A2BE2"];
    } else if (abilityLower.includes('rot') || abilityLower.includes('decay')) {
      return [FaSkull, "#2F4F4F"];
    } else if (abilityLower.includes('dismember')) {
      return [FaFistRaised, "#B22222"];
    } else if (abilityLower.includes('heal') || abilityLower.includes('healing')) {
      return [FaHeartbeat, "#32CD32"];
    } else if (abilityLower.includes('lightning') || abilityLower.includes('bolt')) {
      return [FaBolt, "#FFD700"];
    } else {
      return [FaQuestion, "#696969"];
    }
  };

  const [IconComponent, color] = getIconAndColor();

  return (
    <div className="ability-icon">
      <IconComponent color={color} size={40} />
    </div>
  );
};

export default AbilityIcon;