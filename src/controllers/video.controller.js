import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken/index.js";
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { extname } from "path";

const getAllVideos = asyncHandler(async (req, res) => {
    const videoList = await Video.aggregate(
        [
            {
                $match: {
                    isPublished: true,
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                userName: 1,
                                avatar: 1
                            }
                        },
                    ]
                },

            },
            {
                $addFields: {
                    owner: {
                        $first: "$owner",
                    },
                },
            },
        ]
    );
    return res
        .status(200)
        .json(new ApiResponse(200, videoList, "Video list"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        throw new ApiError(400, "Title and description required");
    }

    if (!req.files?.videoFile) {
        throw new ApiError(400, "Video required");
    }
    if (!req.files?.thumbnail) {
        throw new ApiError(400, "Thumbnail required");
    }

    const videoLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if (extname(videoLocalPath) != ".mp4") {
        throw new ApiError(400, "Unsupported video format");
    }
    if (
        !(
            extname(thumbnailLocalPath) == ".jpeg" ||
            extname(thumbnailLocalPath) == ".jpg" ||
            extname(thumbnailLocalPath) == ".png"
        )
    ) {
        throw new ApiError(400, "Unsupported thumbnail format");
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    const video = await Video.create({
        owner: req.user._id,
        title,
        description,
        duration: videoFile.duration,
        videoFile: videoFile.url,
        videoFilem3u8: videoFile.playback_url,
        isPublished: false,
        thumbnail: thumbnail.url,
    });

    const uploadedVideo = await Video.findById(video._id);

    if (!uploadedVideo) {
        throw new ApiError(500, "Something went wrong while uploading video");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, uploadedVideo, "Video uploaded successfully"));
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if(!videoId){
        throw new ApiError(400,"Videoid is required")
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, ' Video not found')
    }


    const videoUpdate = await Video.findByIdAndUpdate(video._id,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        { new: true }
    )

    return res.status(200).json(
        new ApiResponse(
            200,
            videoUpdate,
            videoUpdate.isPublished?'Video publish succesfully':'Video un-publish'
        )
    )

})

export { getAllVideos, publishAVideo ,togglePublishStatus};
