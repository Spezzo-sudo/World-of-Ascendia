import React from 'react';

export const WoodIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H9v-8a2 2 0 012-2h2a2 2 0 012 2v8z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l-4-4 4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14l4-4-4-4" />
  </svg>
);

export const ClayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2h-5l-2-3H7a2 2 0 00-2 2v13a2 2 0 002 2z" />
  </svg>
);

export const IronIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export const WarehouseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

export const CastleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M4 3h16v2h-2V4h-2v1h-2V4h- situazione-2V4H8v1H6V4H4v1H2V3h2zm0 4h16v1H4V7zm2 2h12v1H6V9zm-2 2h16v1H4v-1zm16 2H4v1h16v-1zm-2 2H6v1h12v-1zm-2 2H8v1h8v-1zm-2 2h-4v1h4v-1z" clipRule="evenodd" transform="scale(1.2) translate(-2, -2)"/>
    <path d="M2 21h20v-2H2v2zM4 19h2v-8H4v8zm14 0h2v-8h-2v8zm-5-8h-4v8h4v-8z"/>
  </svg>
);


export const TreeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 21.646l-6-6.857V12h12v2.789l-6 6.857zM11 12V3.5a1.5 1.5 0 013 0V12h-3z"/>
        <path d="M12 21.646l-6-6.857V12h12v2.789l-6 6.857zM11 12V3.5a1.5 1.5 0 013 0V12h-3z" transform="rotate(45 12 12)" />
        <path d="M12 21.646l-6-6.857V12h12v2.789l-6 6.857zM11 12V3.5a1.5 1.5 0 013 0V12h-3z" transform="rotate(-45 12 12)" />
    </svg>
);
