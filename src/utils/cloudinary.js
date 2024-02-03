import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs'; // file manage


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        // Upload file
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })
         // remove local temp file
         fs.unlinkSync(localFilePath) 
        // File Uploaded
        console.log("file is uploaded on cloudinary ",response.url);
        return response;
    } catch (error) {
        // remove local temp file
        fs.unlinkSync(localFilePath) 
        return null;
    }
}

export {uploadOnCloudinary}


