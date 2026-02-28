"use client";
import React from "react";
const BlogSinglePage = () => {
    return (
        <div className="w-96 h-[892px] relative bg-neutral-50 overflow-hidden">
            <div className="w-96 h-20 p-4 left-0 top-[812px] absolute bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] inline-flex justify-center items-center gap-10 overflow-hidden">
                <div className="inline-flex flex-col justify-center items-center gap-1.5">
                    <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-5 h-4 left-[2px] top-[3px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                        </div>
                    </div>
                </div>
                <div className="inline-flex flex-col justify-center items-center gap-1.5">
                    <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-4 h-5 left-[4px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                        </div>
                    </div>
                </div>
                <div className="inline-flex flex-col justify-center items-center gap-1">
                    <div className="flex flex-col justify-center items-center gap-1.5">
                        <div className="p-2 bg-green-800 rounded-lg inline-flex justify-start items-center gap-2.5">
                            <div className="w-6 h-6 relative overflow-hidden">
                                <div className="w-4 h-5 left-[3px] top-[2.27px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                            </div>
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
                            <div className="w-4 h-5 left-[3.04px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-96 h-[820px] p-5 left-0 top-0 absolute inline-flex flex-col justify-start items-center gap-5">
                <div className="w-14 h-14 bg-zinc-300 rounded-full" />
                <img className="w-28 h-44" src="https://placehold.co/113x170" />
                <div className="justify-start text-green-800 text-3xl font-semibold font-['Inter']">Hi, Gigi</div>
                <div className="w-96 h-28 bg-white rounded-[10px] shadow-[0px_20px_40px_0px_rgba(255,174,0,0.29)] shadow-[0px_5px_10px_0px_rgba(255,174,0,0.26)] flex flex-col justify-center items-center overflow-hidden">
                    <div className="self-stretch p-2.5 inline-flex flex-col justify-start items-start">
                        <div className="self-stretch h-10 px-5 py-2.5 bg-gradient-to-br from-green-800 to-green-800 rounded-lg inline-flex justify-center items-center gap-2.5">
                            <div className="text-center justify-start text-white text-sm font-black font-['Font_Awesome_5_Free'] leading-4">SEARCH</div>
                            <div className="text-center justify-start text-white text-lg font-bold font-['Source_Sans_Pro'] leading-4">Find </div>
                        </div>
                        <div className="self-stretch h-10 p-2.5 bg-gray-200 rounded-lg inline-flex justify-start items-center gap-2.5">
                            <div className="w-5 h-10 text-center justify-center text-green-800 text-2xl font-black font-['Font_Awesome_5_Free'] leading-8">map-marker-alt</div>
                            <div className="flex-1 h-5 justify-center text-neutral-400 text-lg font-normal font-['Open_Sans'] leading-6">Search station or stop</div>
                        </div>
                    </div>
                    <div className="self-stretch p-2.5 bg-white inline-flex flex-col justify-start items-start">
                        <div className="self-stretch self-stretch px-2.5 py-2.5 bg-orange-500/10 rounded-lg inline-flex justify-center items-center gap-1.5">
                            <div className="w-5 h-2.5 outline outline-[1.50px] outline-offset-[-0.75px] outline-green-800" />
                            <div className="w-5 h-3.5 outline outline-[1.50px] outline-offset-[-0.75px] outline-green-800" />
                            <div className="justify-start text-green-800 text-lg font-bold font-['Source_Sans_Pro'] leading-4">Rail</div>
                        </div>
                        <div className="self-stretch p-2.5 bg-orange-500/10 rounded-lg inline-flex justify-center items-center gap-2.5">
                            <div className="w-5 h-5 relative overflow-hidden">
                                <div className="w-5 h-5 left-0 top-0 absolute" />
                                <div className="w-4 h-3.5 left-[1.67px] top-[2.50px] absolute bg-green-800" />
                            </div>
                            <div className="justify-start text-green-800 text-lg font-bold font-['Source_Sans_Pro'] leading-4">Bus</div>
                        </div>
                        <div className="self-stretch h-10 p-2.5 bg-green-800 rounded-lg inline-flex justify-center items-center gap-2.5">
                            <div className="w-4 h-4 bg-white" />
                            <div className="justify-start text-white text-lg font-bold font-['Source_Sans_Pro'] leading-4">Both</div>
                        </div>
                    </div>
                </div>
                <div className="self-stretch h-7 text-center justify-center text-green-800 text-2xl font-bold font-['Inter']">Recently Viewed</div>
                <div className="self-stretch h-36 flex flex-col justify-center items-center">
                    <div className="self-stretch flex-1 px-5 py-2.5 bg-white border-l border-r border-b border-zinc-100 inline-flex flex-col justify-start items-start">
                        <div className="w-1.5 h-3 bg-black" />
                        <div className="self-stretch h-7 justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">Lancaster Station</div>
                    </div>
                    <div className="self-stretch flex-1 px-5 py-2.5 bg-white border-l border-r border-b border-zinc-100 inline-flex flex-col justify-start items-start">
                        <div className="w-1.5 h-3 bg-black" />
                        <div className="self-stretch h-7 justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">Preston Station</div>
                    </div>
                    <div className="self-stretch flex-1 px-5 py-2.5 bg-white border-l border-r border-b border-zinc-100 inline-flex flex-col justify-start items-start">
                        <div className="w-1.5 h-3 bg-black" />
                        <div className="self-stretch h-7 justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">Blackpool North</div>
                    </div>
                </div>
                <div className="self-stretch h-7 px-2.5 inline-flex flex-col justify-start items-start">
                    <div className="self-stretch self-stretch text-right justify-center text-zinc-600 text-base font-medium font-['Inter'] leading-7 tracking-tight">See all</div>
                    <div className="self-stretch self-stretch justify-center text-green-800 text-xl font-semibold font-['Inter']">Quick Links </div>
                </div>
                <div className="self-stretch h-[476px] px-2.5 inline-flex flex-col justify-start items-start">
                    <div className="self-stretch h-48 bg-white rounded-[10px] shadow-[0px_10px_13px_0px_rgba(0,0,0,0.25)] inline-flex flex-col justify-between items-center">
                        <img className="self-stretch h-28 rounded-tl-[10px] rounded-tr-[10px]" src="https://placehold.co/166x110" />
                        <div className="self-stretch h-24 p-2.5 flex flex-col justify-center items-center gap-2.5">
                            <div className="self-stretch h-5 text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Lancaster Station</div>
                            <div className="self-stretch p-2.5 bg-green-800 rounded-[5px] inline-flex justify-center items-center">
                                <div className="text-center justify-start text-white text-base font-medium font-['Roboto'] uppercase">Departures</div>
                            </div>
                        </div>
                    </div>
                    <div className="self-stretch h-48 bg-white rounded-[10px] shadow-[0px_10px_13px_0px_rgba(0,0,0,0.25)] inline-flex flex-col justify-between items-center">
                        <img className="self-stretch h-28 rounded-tl-[10px] rounded-tr-[10px]" src="https://placehold.co/166x110" />
                        <div className="self-stretch h-24 p-2.5 flex flex-col justify-center items-center gap-2.5">
                            <div className="self-stretch h-5 text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Morecambe</div>
                            <div className="self-stretch p-2.5 bg-green-800 rounded-[5px] inline-flex justify-center items-center">
                                <div className="text-center justify-start text-white text-base font-medium font-['Roboto'] uppercase">Departures</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default BlogSinglePage;