import { Router } from "express";
import { changeCurrentPassword, getCurrentuser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, regiserUser, updateAccountDetails, updateUserAvatar } from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route('/register').post(
    upload.fields(
        [
            {
                name: 'avatar',
                maxCount: 1
            },
            {
                name: 'coverImage',
                maxCount: 1
            }
        ]),
    regiserUser
)

router.route('/login').post(loginUser)

//secured routes
router.route('/logout').post(verifyJWT, logoutUser)

router.route('/refreshAccessToken').post(refreshAccessToken)
router.route('/changePassword').post(changeCurrentPassword)
router.route('/get-user').get(getCurrentuser)
router.route('/edit-user').patch(verifyJWT, updateAccountDetails)
router.route('/avatar-edit-user').patch(
    verifyJWT,
    upload.single('avatar'),
    updateUserAvatar
)
router.route('/get-user-channel/:userName').get(verifyJWT, getUserChannelProfile)
router.route('/get-watch-hostory').get(verifyJWT, getWatchHistory)


export default router