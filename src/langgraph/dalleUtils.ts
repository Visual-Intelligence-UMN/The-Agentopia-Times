// import {openai} from "./agents";
    
// export async function generateImage(prompt: string){
    
//     const response = await openai.images.generate({
//         model: "dall-e-3",
//         prompt: prompt,
//         n: 1,
//         size: "1024x1024",
//     });

//     console.log(response.data[0].url);
//     return response.data[0].url;
// }

import { getOpenAI } from "./agents";

export async function generateImage(prompt: string){
  const openai = getOpenAI();  // ✅ 只有这时才实例化

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });

  console.log(response.data[0].url);
  return response.data[0].url;
}