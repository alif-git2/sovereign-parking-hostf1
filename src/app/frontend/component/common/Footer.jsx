import React from 'react';
import { ArrowRightCircle } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-[#0a0a0a] text-white py-12 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
          
          {/* Column 1: Location & Hours */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Location</h3>
              <p className="text-gray-300 leading-relaxed text-sm">
                9 Harris Road, Pinkenba QLD<br />
                4008
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Car Park Hours</h3>
              <div className="text-gray-300 text-sm space-y-1">
                <p>Cruise Days Only</p>
                <p>6am to 2pm</p>
                <p className="mt-4 italic">(late cruise exceptions)</p>
              </div>
            </div>
          </div>

          {/* Column 2: Company & Contact */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Company</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Harris Road Cruise and<br />
                Airport Parking Pty Ltd
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Contact</h3>
              <div className="text-gray-300 text-sm space-y-2">
                <p>04152793472</p>
                <p className="break-all">hello@slateblue-dove-624316.hostingersite.com</p>
              </div>
            </div>
          </div>

          {/* Column 3: Quick Menu */}
          <div>
            <h3 className="text-xl font-bold mb-6">Quick Menu</h3>
            <ul className="space-y-4">
              {['About Us', 'Location', 'Contact', 'FAQs'].map((item) => (
                <li key={item} className="flex items-center group cursor-pointer">
                  <ArrowRightCircle size={18} className="text-pink-400 mr-3 group-hover:text-pink-300 transition-colors" />
                  <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Connect & Logo */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4">Connect</h3>
            {/* Logo Placeholder - Matches the P-Icon style in image */}
            <div className="flex items-center gap-2 mb-6">
               <div className="relative w-12 h-14 bg-blue-500 rounded-t-full rounded-b-lg flex items-center justify-center">
                  <span className="text-white font-black text-2xl">P</span>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-blue-500"></div>
               </div>
               <div className="leading-tight">
                  <span className="block text-2xl font-bold tracking-tight">Sovereign</span>
                  <span className="block text-2xl font-light tracking-widest uppercase -mt-1">Parking</span>
               </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-pink-300">
               
              </div>
              <div className="w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-pink-300">
          
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 text-center text-xs text-gray-400 leading-relaxed">
          <p>
            © 2025 <span className="text-pink-400">Sovereign Parking</span> ABN: 93 684 496 893 | 
            <span className="hover:text-pink-400 cursor-pointer mx-1"> Website Disclaimer </span> | 
            <span className="hover:text-pink-400 cursor-pointer mx-1"> Terms and Conditions </span> | 
            <span className="hover:text-pink-400 cursor-pointer mx-1"> WHSE Policy </span> | 
            <span className="hover:text-pink-400 cursor-pointer mx-1"> Privacy Policy </span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;