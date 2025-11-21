import React from 'react';
import { FaDragon, FaUser, FaShieldAlt, FaBolt, FaFire, FaWater, FaWind, FaTree, FaCube, FaQuestion } from 'react-icons/fa';
import { IconType } from 'react-icons';

interface HeroIconProps {
  heroName: string;
  size?: 'small' | 'medium' | 'large';
}

const HeroIcon: React.FC<HeroIconProps> = ({ heroName, size = 'medium' }) => {
  const getIconSize = () => {
    switch (size) {
      case 'small': return 24;
      case 'large': return 64;
      default: return 32;
    }
  };

  const getIconAndColor = (): [IconType, string] => {
    const heroLower = heroName.toLowerCase();
    
    if (heroLower.includes('pudge')) {
      return [FaShieldAlt, "#8B4513"];
    } else if (heroLower.includes('invoker')) {
      return [FaDragon, "#4169E1"];
    } else if (heroLower.includes('dragon')) {
      return [FaDragon, "#FF4500"];
    } else if (heroLower.includes('fire')) {
      return [FaFire, "#FF4500"];
    } else if (heroLower.includes('water')) {
      return [FaWater, "#1E90FF"];
    } else if (heroLower.includes('wind')) {
      return [FaWind, "#32CD32"];
    } else if (heroLower.includes('earth') || heroLower.includes('tree')) {
      return [FaTree, "#8B4513"];
    } else {
      return [FaQuestion, "#696969"];
    }
  };

  const [IconComponent, color] = getIconAndColor();

  return (
    <div className="hero-icon">
      <IconComponent color={color} size={getIconSize()} />
    </div>
  );
};

export default HeroIcon;