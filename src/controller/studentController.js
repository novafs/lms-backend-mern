import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import { mutateStudentSchema } from "../utils/schema.js";
import courseModel from "../models/courseModel.js";
// import path from 'path';
// import fs from 'fs';
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

const uploadStream = (fileData) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "lms/students" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    streamifier.createReadStream(fileData.buffer).pipe(stream);
  });

  // Helper function to extract Cloudinary Public ID from the secure URL
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    
    // Cloudinary URL structure: .../upload/v[VERSION]/folder/public_id.extension
    const parts = url.split('/');
    const publicIdWithExtension = parts.slice(-2).join('/'); // Get folder/public_id.extension
    const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
    return publicId;
};

export const getStudents = async (req, res) => {
  try {
    const students = await userModel
      .find({
        role: "student",
        manager: req.user._id,
      })
      .select("name courses photo");

    // const photoUrl = process.env.APP_URL + "/uploads/students/";

    const response = students.map((item) => {
      return {
        ...item.toObject(),
        // photo_url: photoUrl + item.photo,
      };
    });

    return res.json({
      message: "Get students success",
      data: response,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await userModel.findById(id).select("name email photo");

    return res.json({
      message: "Get Detail Student success",
      data: student,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const postStudent = async (req, res) => {
  try {
    const body = req.body;

    const parse = mutateStudentSchema.safeParse(body);

    if (!parse.success) {
      const errorMessages = parse.error.issues.map((err) => err.message);

      // if ((req?.file?.path && fs, existsSync(req?.file?.path))) {
      //   fs.unlinkSync(req?.file?.path);
      // }
      
      res.status(500).json({
        message: "Error validation",
        data: null,
        errors: errorMessages,
      });
    }

    const photo = await uploadStream(req.file);
    const photo_url = photo.secure_url;
    const hashPassword = bcrypt.hashSync(body.password, 12);

    const student = new userModel({
      name: parse.data.name,
      email: parse.data.email,
      password: hashPassword,
      photo: photo_url,
      manager: req.user?._id,
      role: "student",
    });

    await student.save();

    return res.json({
      message: "Create student success",
      student
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const updateStudent = async (req, res) => {
  try {
    let photo_url = null
    const { id } = req.params;
    const body = req.body;

    const parse = mutateStudentSchema
      .partial({
        password: true,
      })
      .safeParse(body);

    if (!parse.success) {
      const errorMessages = parse.error.issues.map((err) => err.message);

      // if ((req?.file?.path && fs, existsSync(req?.file?.path))) {
      //   fs.unlinkSync(req?.file?.path);
      // }

      res.status(500).json({
        message: "Error validation",
        data: null,
        errors: errorMessages,
      });
    }

    const student = await userModel.findById(id);

    if (req.file) {
      // Upload new file to Cloudinary
      const newPhoto = await uploadStream(req.file);
      photo_url = newPhoto.secure_url; // Set the new photo URL

      // Check if there is an old photo to delete
      if (student.photo) {
        const oldPublicId = getPublicIdFromUrl(student.photo);
        if (oldPublicId) {
          // Delete old file from Cloudinary
          await cloudinary.uploader.destroy(oldPublicId);
          console.log(`Cloudinary: Deleted old file with ID ${oldPublicId}`);
        }
      }
    } else {
      // If no new file, retain the old photo URL
      photo_url = student.photo;
    }

    const hashPassword = parse.data?.password
      ? bcrypt.hashSync(parse.data.password, 12)
      : student.password;

    await userModel.findByIdAndUpdate(id, {
      name: parse.data.name,
      email: parse.data.email,
      password: hashPassword,
      photo: req?.file ? req.file?.filename : student.photo,
    });

    await student.save();

    return res.json({
      message: "Update student success",
      student
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await userModel.findById(id);

    await courseModel.findOneAndUpdate(
      {
        students: id,
      },
      {
        $pull: {
          students: id,
        },
      }
    );

    if (student.photo) {
        const oldPublicId = getPublicIdFromUrl(student.photo);
        if (oldPublicId) {
          // Delete old file from Cloudinary
          await cloudinary.uploader.destroy(oldPublicId);
          console.log(`Cloudinary: Deleted old file with ID ${oldPublicId}`);
        }
      }

    await userModel.findByIdAndDelete(id);

    return res.json({
      message: "Delete student success",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getCoursesStudents = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id).populate({
      path: "courses",
      select: "name category thumbnail",
      populate: {
        path: "category",
        select: "name",
      },
    });

    const imageUrl = process.env.APP_URL + "/uploads/courses/";

    const response = user?.courses?.map((item) => {
      return {
        ...item.toObject(),
        thumbnail_url: imageUrl + item.thumbnail,
      };
    });

    return res.json({
      message: "Get courses success",
      data: response,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
