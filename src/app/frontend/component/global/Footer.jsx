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

            {/* Logo Area */}
            <div className="flex items-center gap-3">
              <img
                src="/site-logo.svg"
                alt="Logo"
                className="w-40 h-20 object-contain"
              />
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-pink-300 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 440 146.7 540.8 258.2 568.5L258.2 398.2L205.4 398.2L205.4 320L258.2 320L258.2 286.3C258.2 199.2 297.6 158.8 383.2 158.8C399.4 158.8 427.4 162 438.9 165.2L438.9 236C432.9 235.4 422.4 235 409.3 235C367.3 235 351.1 250.9 351.1 292.2L351.1 320L434.7 320L420.3 398.2L351 398.2L351 574.1C477.8 558.8 576 450.9 576 320z" /></svg>
              </div>
              <div className="w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-pink-300 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M320.3 205C256.8 204.8 205.2 256.2 205 319.7C204.8 383.2 256.2 434.8 319.7 435C383.2 435.2 434.8 383.8 435 320.3C435.2 256.8 383.8 205.2 320.3 205zM319.7 245.4C360.9 245.2 394.4 278.5 394.6 319.7C394.8 360.9 361.5 394.4 320.3 394.6C279.1 394.8 245.6 361.5 245.4 320.3C245.2 279.1 278.5 245.6 319.7 245.4zM413.1 200.3C413.1 185.5 425.1 173.5 439.9 173.5C454.7 173.5 466.7 185.5 466.7 200.3C466.7 215.1 454.7 227.1 439.9 227.1C425.1 227.1 413.1 215.1 413.1 200.3zM542.8 227.5C541.1 191.6 532.9 159.8 506.6 133.6C480.4 107.4 448.6 99.2 412.7 97.4C375.7 95.3 264.8 95.3 227.8 97.4C192 99.1 160.2 107.3 133.9 133.5C107.6 159.7 99.5 191.5 97.7 227.4C95.6 264.4 95.6 375.3 97.7 412.3C99.4 448.2 107.6 480 133.9 506.2C160.2 532.4 191.9 540.6 227.8 542.4C264.8 544.5 375.7 544.5 412.7 542.4C448.6 540.7 480.4 532.5 506.6 506.2C532.8 480 541 448.2 542.8 412.3C544.9 375.3 544.9 264.5 542.8 227.5zM495 452C487.2 471.6 472.1 486.7 452.4 494.6C422.9 506.3 352.9 503.6 320.3 503.6C287.7 503.6 217.6 506.2 188.2 494.6C168.6 486.8 153.5 471.7 145.6 452C133.9 422.5 136.6 352.5 136.6 319.9C136.6 287.3 134 217.2 145.6 187.8C153.4 168.2 168.5 153.1 188.2 145.2C217.7 133.5 287.7 136.2 320.3 136.2C352.9 136.2 423 133.6 452.4 145.2C472 153 487.1 168.1 495 187.8C506.7 217.3 504 287.3 504 319.9C504 352.5 506.7 422.6 495 452z" /></svg>
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