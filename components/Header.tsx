
import React from 'react';
import { ResourceType } from '../types';
import ResourceBar from './ResourceBar';

interface HeaderProps {
  resources: {
    [ResourceType.Wood]: number;
    [ResourceType.Clay]: number;
    [ResourceType.Iron]: number;
  };
  warehouseCapacity: number;
}

const Header: React.FC<HeaderProps> = ({ resources, warehouseCapacity }) => {
  return (
    <header className="bg-black bg-opacity-30 text-white p-4 shadow-lg backdrop-blur-sm">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl md:text-4xl font-bold font-medieval tracking-widest text-yellow-400" style={{textShadow: '2px 2px 4px #000'}}>
          Welt von Ascendia
        </h1>
        <ResourceBar resources={resources} capacity={warehouseCapacity} />
      </div>
    </header>
  );
};

export default Header;
