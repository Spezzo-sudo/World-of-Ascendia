
import React from 'react';

const ArmyView: React.FC = () => {
  return (
    <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-2xl border border-gray-700 backdrop-blur-sm text-center">
      <h2 className="text-3xl font-bold mb-4 text-yellow-300 font-medieval">Armee-Übersicht</h2>
      <div className="w-full h-96 bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-600">
        <p className="text-gray-400 text-xl">Die Kaserne wird gerade errichtet. Rekrutiere bald deine ersten Truppen.</p>
      </div>
       <p className="mt-4 text-gray-300">Hier wirst du deine Einheiten rekrutieren, deine Armeen verwalten und Angriffe auf deine Feinde starten.</p>
    </div>
  );
};

export default ArmyView;
