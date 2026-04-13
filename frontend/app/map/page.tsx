"use client";
import React from "react";
const BlogSinglePage = () => {
    return (
        <div className="w-96 h-[892px] relative bg-neutral-50 overflow-hidden">
            <img className="w-96 h-[892px] left-0 top-0 absolute" src="/map.png" />
            <div className="w-96 left-0 top-[752px] absolute inline-flex flex-col justify-start items-start">
                <div className="self-stretch h-14 px-5 py-2.5 bg-white inline-flex flex-col justify-start items-start">
                    <div className="self-stretch self-stretch px-2.5 py-2.5 bg-orange-500/10 rounded-lg inline-flex justify-center items-center gap-1.5">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-4 h-5 left-[4px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-green-800" />
                        </div>
                        <div className="justify-start text-green-800 text-lg font-bold font-['Source_Sans_Pro'] leading-4">Metro</div>
                    </div>
                    <div className="self-stretch self-stretch px-2.5 py-2.5 bg-orange-500/10 rounded-lg inline-flex justify-center items-center gap-1.5">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-4 h-5 left-[4px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-green-800" />
                        </div>
                        <div className="w-12 justify-start text-green-800 text-lg font-bold font-['Source_Sans_Pro'] leading-4">Tram</div>
                    </div>
                    <div className="self-stretch h-10 p-2.5 bg-green-800 rounded-lg inline-flex justify-center items-center gap-2.5">
                        <div className="w-5 h-5 relative overflow-hidden">
                            <div className="w-5 h-5 left-0 top-0 absolute" />
                            <div className="w-4 h-3.5 left-[1.67px] top-[2.50px] absolute bg-white" />
                        </div>
                        <div className="justify-start text-white text-lg font-bold font-['Source_Sans_Pro'] leading-4">Bus</div>
                    </div>
                </div>
                <div className="self-stretch h-20 p-4 bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] flex flex-col justify-center items-center gap-2.5 overflow-hidden">
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
            <div className="w-96 h-56 left-0 top-0 absolute bg-gradient-to-t from-zinc-300/0 to-neutral-500" />
            <div className="w-96 p-4 left-0 top-0 absolute bg-gradient-to-t from-white/0 to-neutral-400/0 shadow-[0px_5px_20px_0px_rgba(9,50,98,0.02)] inline-flex justify-start items-center gap-4">
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
            <div className="w-6 h-6 p-1 left-[56px] top-[223px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[185px] top-[272px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[282px] top-[245px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[264px] top-[536px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[135px] top-[659px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[283px] top-[159px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="p-0.5 left-[300.80px] top-[149px] absolute bg-blue-600 rounded outline outline-2 outline-offset-[-2px] outline-neutral-50 inline-flex justify-start items-start gap-2.5">
                <div className="w-3 h-3 relative overflow-hidden">
                    <div className="w-px h-px left-[7.50px] top-[1.50px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-[3px] h-1 left-[6.50px] top-[6px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.25px] left-[2.50px] top-[2.50px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.23px] left-[2.01px] top-[7.25px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.23px] left-[3.44px] top-[5.52px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[19px] top-[370px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="p-0.5 left-[36.80px] top-[360px] absolute bg-blue-600 rounded outline outline-2 outline-offset-[-2px] outline-neutral-50 inline-flex justify-start items-start gap-2.5">
                <div className="w-3 h-3 relative overflow-hidden">
                    <div className="w-px h-px left-[7.50px] top-[1.50px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-[3px] h-1 left-[6.50px] top-[6px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.25px] left-[2.50px] top-[2.50px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.23px] left-[2.01px] top-[7.25px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.23px] left-[3.44px] top-[5.52px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                </div>
            </div>
            <div className="w-6 h-6 p-1 left-[364px] top-[533px] absolute bg-gray-800 rounded-lg inline-flex justify-center items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="p-0.5 left-[381.80px] top-[523px] absolute bg-blue-600 rounded outline outline-2 outline-offset-[-2px] outline-neutral-50 inline-flex justify-start items-start gap-2.5">
                <div className="w-3 h-3 relative overflow-hidden">
                    <div className="w-px h-px left-[7.50px] top-[1.50px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-[3px] h-1 left-[6.50px] top-[6px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.25px] left-[2.50px] top-[2.50px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.23px] left-[2.01px] top-[7.25px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                    <div className="w-1 h-[3.23px] left-[3.44px] top-[5.52px] absolute outline outline-1 outline-offset-[-0.50px] outline-white" />
                </div>
            </div>
            <div className="p-1 left-[96px] top-[185px] absolute bg-gray-800 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-[1.33px] h-[0.67px] left-[1.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[2.67px] h-0 left-[6.67px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[1.33px] h-[0.67px] left-[13.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-2.5 left-[2.67px] top-[2px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-0 left-[2.67px] top-[7.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[5.33px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[10.67px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[4px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[12px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
                <div className="justify-center text-white text-xs font-medium font-['Inter'] leading-4">1</div>
            </div>
            <div className="p-1 left-[365px] top-[280px] absolute bg-gray-800 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-[1.33px] h-[0.67px] left-[1.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[2.67px] h-0 left-[6.67px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[1.33px] h-[0.67px] left-[13.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-2.5 left-[2.67px] top-[2px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-0 left-[2.67px] top-[7.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[5.33px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[10.67px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[4px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[12px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
                <div className="justify-center text-white text-xs font-medium font-['Inter'] leading-4">31</div>
            </div>
            <div className="p-1 left-[44px] top-[437px] absolute bg-gray-800 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-[1.33px] h-[0.67px] left-[1.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[2.67px] h-0 left-[6.67px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[1.33px] h-[0.67px] left-[13.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-2.5 left-[2.67px] top-[2px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-0 left-[2.67px] top-[7.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[5.33px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[10.67px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[4px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[12px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
                <div className="justify-center text-white text-xs font-medium font-['Inter'] leading-4">112</div>
            </div>
            <div className="p-1 left-[255px] top-[477px] absolute bg-gray-800 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-[1.33px] h-[0.67px] left-[1.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[2.67px] h-0 left-[6.67px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[1.33px] h-[0.67px] left-[13.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-2.5 left-[2.67px] top-[2px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-0 left-[2.67px] top-[7.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[5.33px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[10.67px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[4px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[12px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
                <div className="justify-center text-white text-xs font-medium font-['Inter'] leading-4">79</div>
            </div>
            <div className="p-1 left-[186px] top-[647px] absolute bg-gray-800 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-[1.33px] h-[0.67px] left-[1.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[2.67px] h-0 left-[6.67px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[1.33px] h-[0.67px] left-[13.33px] top-[4px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-2.5 left-[2.67px] top-[2px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-2.5 h-0 left-[2.67px] top-[7.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[5.33px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-[0.01px] h-0 left-[10.67px] top-[10px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[4px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                    <div className="w-0 h-[1.33px] left-[12px] top-[12.67px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
                <div className="justify-center text-white text-xs font-medium font-['Inter'] leading-4">279</div>
            </div>
            {/* <div className="w-56 h-64 left-[122px] top-[378.50px] absolute rounded-[10px] outline outline-[5px] outline-offset-[-2.50px] outline-blue-600" /> */}
            <div className="p-1 left-[185px] top-[364px] absolute bg-blue-600 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3 h-3.5 left-[2.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-4 h-4 left-[158px] top-[377px] absolute bg-blue-600 rounded-full shadow-[0px_4px_4px_0px_rgba(0,0,0,0.03)] border-[3px] border-white" />
            <div className="p-1 left-[336px] top-[619px] absolute bg-blue-600 rounded-lg inline-flex justify-start items-center gap-1">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-2.5 h-3.5 left-[2.67px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-white" />
                </div>
            </div>
            <div className="w-12 h-12 left-[347px] top-[675px] absolute bg-green-800 rounded-[10px] overflow-hidden">
                <div className="w-6 h-6 left-[13px] top-[12px] absolute overflow-hidden">
                    <div className="w-5 h-5 left-[2px] top-[2px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                </div>
            </div>
        </div>
    );
};
export default BlogSinglePage;