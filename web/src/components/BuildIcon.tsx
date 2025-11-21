import React from 'react';
import { FaGem, FaMagic, FaShieldAlt, FaBolt, FaHeart, FaCrosshairs, FaMedkit, FaArrowsAlt, FaQuestion } from 'react-icons/fa';
import { IconType } from 'react-icons';

interface BuildIconProps {
  itemName: string;
}

const BuildIcon: React.FC<BuildIconProps> = ({ itemName }) => {
  const getIconAndColor = (): [IconType, string] => {
    const itemLower = itemName.toLowerCase();
    
    if (itemLower.includes('scepter') || itemLower.includes('aghanim')) {
      return [FaGem, "#9370DB"];
    } else if (itemLower.includes('sheep') || itemLower.includes('hex')) {
      return [FaMagic, "#FF69B4"];
    } else if (itemLower.includes('boots') || itemLower.includes('travel')) {
      return [FaCrosshairs, "#8B4513"];
    } else if (itemLower.includes('kings') || itemLower.includes('black')) {
      return [FaShieldAlt, "#2F4F4F"];
    } else if (itemLower.includes('blink')) {
      return [FaBolt, "#00BFFF"];
    } else if (itemLower.includes('pipe') || itemLower.includes('insight')) {
      return [FaHeart, "#FF6347"];
    } else if (itemLower.includes('force')) {
      return [FaArrowsAlt, "#00FA9A"];
    } else if (itemLower.includes('med') || itemLower.includes('heal')) {
      return [FaMedkit, "#32CD32"];
    } else {
      return [FaQuestion, "#696969"];
    }
  };

  const [IconComponent, color] = getIconAndColor();

  return (
    <div className="build-icon">
      <IconComponent color={color} size={24} />
    </div>
  );
};

export default BuildIcon;