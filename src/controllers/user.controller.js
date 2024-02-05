import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from 'jsonwebtoken/index.js'
import mongoose from "mongoose"

const genrerateAccessAndRefereshTokens = async(userId) => 
{
    try {
        const user = await User.findById(userId);   
        const refreshToken = user.generateRefreshToken()
        const accessToken = user.generateAccessToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}


const regiserUser = asyncHandler( async (req, res) => {
    
    const {fullName, email, userName, password } = req.body

    if (
        [fullName, email, userName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User already register with email or username")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:  coverImage?.url || '',
        email,
        userName: userName.toLowerCase(),
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registring the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registred successfully")
    )
})

const loginUser = asyncHandler( async (req,res) => {

    const {email, userName, password} = req.body
    console.log(req.body);
    if(!userName && !email){
        throw new ApiError(400, " username or email is required")
    }

    const user = await User.findOne({
        $or: [{ email }, { userName }]
    })
    console.log(user);

    if(!user){
        throw new ApiError(404, " User not fount")
    }
    
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await genrerateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser,
                        accessToken,
                        refreshToken
                    },
                    "User logged in successfully"
                )
            )

})

const logoutUser = asyncHandler(async (req,res) => {
    console.log(req.user._id);
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
            .status(200)
            .clearCookie('accessToken', options)
            .clearCookie('refreshToken', options)
            .json(
                new ApiResponse(
                    200,
                    {},
                    "User logged out successfully"
                )
            )
})

const refreshAccessToken = asyncHandler(async (req,res) => {

    const incommingToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incommingToken){
        throw new ApiError(401, 'unauthorized request') 
    }
    try {
        const decodedToken = jwt.verify(incommingToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id)
    
        if(!user){
            throw new ApiError(401, 'Invalid refresh token') 
        }
    
        if(incommingToken != user?.refreshToken){
            throw new ApiError(401, 'Refresh token is expired or used') 
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken, refreshToken} = await genrerateAccessAndRefereshTokens(user._id)
    
        return res
                .status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", refreshToken, options)
                .json(
                    new ApiResponse(
                        200,
                        {
                            accessToken,
                            refreshToken
                        },
                        "Access token refreshed"
                    )
                )
    } catch (error) {
        throw new ApiError(401, error?.message || 'Invalid refresh token') 
    }

})

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordVerify = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordVerify){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(
            200,{},"Password change successfully"
        )
    )
})

const getCurrentuser = asyncHandler(async(req,res) =>{
    return res.status(200).json(
        new ApiResponse(200,req.user,'Current user fetched successfully')
    )
})


const updateAccountDetails = asyncHandler(async(req,res) =>{
    const {fullName, email} = req.body

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200).json(
        new ApiResponse(200,user,'User updated successfully')
    )
})

const updateUserAvatar = asyncHandler(async(req,res) =>{

    let avatarLocalPath = req.file.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200).json(
        new ApiResponse(200,user,'User updated successfully')
    )
})

const getUserChannelProfile = asyncHandler(async(req,res) =>{
    console.log(req.params);
    const {userName} = req.params

    if(!userName?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate(
        [
            {
                $match: {
                    userName: userName?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    subscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    // _id: 1,
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1,
                    subscribersCount: 1,
                    subscribedToCount: 1,
                    isSubscribed: 1,
                }
            }
        ]
    )

    if(!channel?.length){
        throw new ApiError(404, 'Channel does not exists')
    }

    return res.status(200).json(
        new ApiResponse(200,channel[0],'Channel found')
    )

})

const getWatchHistory = asyncHandler(async(req,res) =>{
    const user = await User.aggregate([
        {
            $match: {
                _id:  new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
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
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res.status(200).json(
        new ApiResponse(200,user[0].watchHistory,'Watch hostory fetch successfully')
    )

})


export {
    regiserUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentuser,
    updateAccountDetails,
    updateUserAvatar,
    getUserChannelProfile,
    getWatchHistory
}