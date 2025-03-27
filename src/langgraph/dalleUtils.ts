import {openai} from "./agents";
    
export async function generateImage(prompt: string){
    
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "256x256",
    });

    console.log(response.data[0].url);
    return response.data[0].url;
}

