"use client";
import React from "react";
import Image from "next/image";
const BlogSinglePage = () => {
    return (
        <div className="w-screen flex flex-col items-center justify-center h-screen relative bg-neutral-50 overflow-hidden">
            <img className="w-full left-0 top-0 absolute" src="/map.png" />
            
            {/*Gradient*/}
            <div className="w-full h-56 left-0 top-0 absolute bg-gradient-to-t from-zinc-300/0 to-neutral-500" />

            {/* Location Entry Boxes */}
            <div className="w-96 p-4 top-0 absolute bg-gradient-to-t from-white/0 to-neutral-400/0 shadow-[0px_5px_20px_0px_rgba(9,50,98,0.02)] inline-flex justify-start items-center gap-4">
                <div className="flex-1 relative inline-flex flex-col justify-start items-start gap-3">
                    <div className="w-96 h-12 p-4 bg-neutral-50 rounded-[10px] outline outline-2 outline-offset-[-2px] outline-neutral-300 inline-flex justify-start items-center gap-2.5 overflow-hidden">
                        <div className="justify-center text-gray-800 text-xs font-normal font-['Inter'] leading-4">Temple</div>
                    </div>
                    <div className="w-96 h-12 p-4 bg-neutral-50 rounded-[10px] outline outline-2 outline-offset-[-2px] outline-neutral-300 inline-flex justify-start items-center gap-2.5 overflow-hidden">
                        <div className="justify-center text-gray-800 text-xs font-normal font-['Inter'] leading-4">Theed St.</div>
                    </div>
                    <div className="p-1 left-[332px] top-[38px] absolute bg-green-800 rounded-[10px] inline-flex justify-start items-start gap-2.5">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-4 h-4 left-[3px] top-[4px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full flex flex-col inline-flex justify-center items-center bottom-0 absolute">

                {/*Current Location Center Button*/}
                <div className="flex-1">
                    <div className="w-12 h-12 flex justify-center items-center right-5 absolute bg-green-800 rounded-[10px] overflow-hidden">
                        <Image
                            className="white"
                            src="/icons/center_location.svg"
                            alt="Center_location"
                            width={30}
                            height={30}
                        />
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="self-stretch flex-1 inline-flex flex-row justify-center items-center px-20 py-10 gap-10 bg-white">
                    
                    <div className="self-stretch justify-center items-center flex flex-row inline-flex min-h-12 min-w-30 px-5 w-full bg-orange-500/10 rounded-lg">
                        <Image
                            className="white"
                            src="/icons/walk_icon.svg"
                            alt="Walk"
                            width={40}
                            height={40}
                        />
                        <div className="w-full text-center text-green-800 text-lg font-bold font-['Inter']">Walk</div>
                    </div>

                    <div className="self-stretch justify-center items-center flex flex-row inline-flex min-h-12 min-w-30 px-5 w-full bg-orange-500/10 rounded-lg">
                        <Image
                            className="text-green-800"
                            src="/icons/train_icon.svg"
                            alt="Train"
                            width={40}
                            height={40}
                        />
                        <div className="w-full text-center text-green-800 text-lg font-bold font-['Inter']">Train</div>
                    </div>

                    <div className="self-stretch justify-center items-center flex flex-row inline-flex min-h-12 min-w-30 px-5 w-full bg-green-800 rounded-lg">
                        <Image
                            className="white"
                            src="/icons/bus_icon.svg"
                            alt="Bus"
                            width={40}
                            height={40}
                        />
                        <div className="w-full text-center text-white text-lg font-bold font-['Inter']">Bus</div>
                    </div>
                </div>

                {/*Bottom Bar*/}
                <div className="self-stretch flex-0 h-20 p-4 bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] flex flex-col justify-center items-center gap-2.5 overflow-hidden">
                    <div className="w-96 px-6 inline-flex justify-between items-center">
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <div className="w-5 h-4 left-[2px] top-[3px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                                </div>
                            </div>
                        </div>
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-2 bg-green-800 rounded-[10px] inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <div className="w-4 h-5 left-[4px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                                </div>
                            </div>
                        </div>
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <div className="w-4 h-5 left-[3px] top-[2.27px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                                </div>
                            </div>
                        </div>
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <div className="w-4 h-4 left-[4px] top-[3px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                                </div>
                            </div>
                        </div>
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <div className="w-4 h-5 left-[3.05px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default BlogSinglePage;