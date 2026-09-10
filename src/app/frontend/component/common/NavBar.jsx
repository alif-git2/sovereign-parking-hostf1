import React from 'react';
import { MapPin, Mail, Phone, ChevronDown } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="w-full font-sans">
      {/* Top Header Section */}
      <div className="bg-[#1d63d2] text-white py-4 px-6 border-b border-blue-400/30">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          
          {/* Logo Area */}
          <div className="flex items-center gap-3">
             <div className="relative w-10 h-12 bg-white rounded-t-full rounded-b-lg flex items-center justify-center">
                <span className="text-[#1d63d2] font-black text-xl">P</span>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
             </div>
             <div className="leading-tight">
                <span className="block text-xl font-bold tracking-tight">Sovereign</span>
                <span className="block text-xl font-light tracking-[0.15em] uppercase -mt-1">Parking</span>
             </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap items-center gap-6 text-[13px]">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-pink-400 fill-pink-400/20" />
              <span>9 Harris Road, Pinkenba QLD 4008</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-pink-400 fill-pink-400/20" />
              <span>hello@slateblue-dove-624316.hostingersite.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-pink-400 fill-pink-400/20" />
              <span>Call Us : 04152793472</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="bg-[#1d63d2] text-white py-4 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Nav Links */}
          <ul className="flex items-center gap-8 text-sm font-medium">
            <li className="hover:text-pink-300 cursor-pointer transition-colors">Cruise Ship Schedule</li>
            <li className="flex items-center gap-1 hover:text-pink-300 cursor-pointer transition-colors">
              Services <ChevronDown size={14} />
            </li>
            <li className="hover:text-pink-300 cursor-pointer transition-colors">About</li>
            <li className="hover:text-pink-300 cursor-pointer transition-colors">Contact Us</li>
          </ul>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button className="bg-[#ff99cc] text-white px-8 py-2.5 rounded-lg font-bold text-sm shadow-lg hover:bg-[#ff85c2] transition-all">
              Book Now
            </button>
            <button className="bg-[#ff99cc] text-white px-10 py-2.5 rounded-lg font-bold text-sm shadow-lg hover:bg-[#ff85c2] transition-all">
              Login
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;