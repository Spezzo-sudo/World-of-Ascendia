
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black bg-opacity-30 text-center text-gray-500 p-4 mt-auto">
      <p>&copy; {new Date().getFullYear()} Welt von Ascendia. Alle Rechte vorbehalten.</p>
    </footer>
  );
};

export default Footer;
