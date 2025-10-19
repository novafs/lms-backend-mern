import { response } from "express";
import categoryModel from "../models/categoryModel.js";
import courseModel from "../models/courseModel.js";
import userModel from "../models/userModel.js";
import { mutateCourseSchema } from "../utils/schema.js";
// import fs, { existsSync } from 'fs';
// import path from "path";
import courseDetailModel from "../models/courseDetailModel.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

const uploadStream = (fileData) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "lms/courses" },
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
  const parts = url.split("/");
  const publicIdWithExtension = parts.slice(-2).join("/"); // Get folder/public_id.extension
  const publicId = publicIdWithExtension.substring(
    0,
    publicIdWithExtension.lastIndexOf(".")
  );
  return publicId;
};

export const getCourses = async (req, res) => {
  try {
    const courses = await courseModel
      .find({
        manager: req.user?._id,
      })
      .select("name thumbnail")
      .populate({
        path: "category",
        select: "name -_id",
      })
      .populate({
        path: "students",
        select: "name",
      });

    // const imageUrl = process.env.APP_URL + '/uploads/courses/'

    const response = courses.map((item) => {
      return {
        ...item.toObject(),
        // thumbnail_url: imageUrl + item.thumbnail,
        totalStudents: item.students.length,
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

export const getCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find();
    return res.json({
      message: "Get Category success",
      data: categories,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { preview } = req.query;

    const course = await courseModel
      .findById(id)
      .populate({
        path: "category",
        select: "name -_id",
      })
      .populate({
        path: "details",
        select: preview === "true" ? "title type youtubeId text" : "title type",
      });

    // const imageUrl = process.env.APP_URL + '/uploads/courses/'

    return res.json({
      message: "Get Course Detail success",
      data: {
        ...course.toObject(),
        // thumbnail_url: imageUrl + course.thumbnail
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const postCourse = async (req, res) => {
  try {
    const body = req.body;

    const parse = mutateCourseSchema.safeParse(body);

    if (!parse.success) {
      const errorMessages = parse.error.issues.map((err) => err.message);

      //   if ((req?.file?.path && fs, existsSync(req?.file?.path))) {
      //     fs.unlinkSync(req?.file?.path);
      //   }

      res.status(500).json({
        message: "Error validation",
        data: null,
        errors: errorMessages,
      });
    }

    const category = await categoryModel.findById(parse.data.categoryId);

    if (!category) {
      return res.status(500).json({
        message: "Category ID not found",
      });
    }

    const thumbnail = await uploadStream(req.file);
    const thumbnail_url = thumbnail.secure_url;

    const course = new courseModel({
      name: parse.data.name,
      category: category._id,
      description: parse.data.description,
      tagline: parse.data.tagline,
      thumbnail: thumbnail_url,
      manager: req.user._id,
    });

    await course.save();

    await categoryModel.findByIdAndUpdate(
      category._id,
      {
        $push: {
          courses: course._id,
        },
      },
      { new: true }
    );

    await userModel.findByIdAndUpdate(
      req.user?._id,
      {
        $push: {
          courses: course._id,
        },
      },
      { new: true }
    );

    return res.json({ message: "Create Course success" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const body = req.body;

    const parse = mutateCourseSchema.safeParse(body);

    const courseId = req.params.id;

    let thumbnail_url = null;

    if (!parse.success) {
      const errorMessages = parse.error.issues.map((err) => err.message);

      //   if ((req?.file?.path && fs, existsSync(req?.file?.path))) {
      //     fs.unlinkSync(req?.file?.path);
      //   }

      res.status(500).json({
        message: "Error validation",
        data: null,
        errors: errorMessages,
      });
    }

    const category = await categoryModel.findById(parse.data.categoryId);

    const oldCourse = await courseModel.findById(courseId);

    if (!category) {
      return res.status(500).json({
        message: "Category ID not found",
      });
    }

    if (req.file) {
      // Upload new file to Cloudinary
      const newThumbnail = await uploadStream(req.file);
      thumbnail_url = newThumbnail.secure_url; // Set the new photo URL

      // Check if there is an old photo to delete
      if (oldCourse.thumbnail) {
        const oldPublicId = getPublicIdFromUrl(oldCourse.thumbnail);
        if (oldPublicId) {
          // Delete old file from Cloudinary
          await cloudinary.uploader.destroy(oldPublicId);
          console.log(`Cloudinary: Deleted old file with ID ${oldPublicId}`);
        }
      }
    } else {
      // If no new file, retain the old photo URL
      thumbnail_url = oldCourse.thumbnail;
    }

    await courseModel.findByIdAndUpdate(courseId, {
      name: parse.data.name,
      category: category._id,
      description: parse.data.description,
      tagline: parse.data.tagline,
      thumbnail: thumbnail_url,
      manager: req.user._id,
    });

    return res.json({ message: "Update Course success" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await courseModel.findById(id);
    // const dirname = path.resolve();
    // const filePath = path.join(
    //   dirname,
    //   "public/uploads/courses",
    //   course.thumbnail
    // );

    // if (fs.existsSync(filePath)) {
    //   fs.unlinkSync(filePath);
    // }

    // Check if there is an old photo to delete
    if (course.thumbnail) {
      const oldPublicId = getPublicIdFromUrl(course.thumbnail);
      if (oldPublicId) {
        // Delete old file from Cloudinary
        await cloudinary.uploader.destroy(oldPublicId);
        console.log(`Cloudinary: Deleted old file with ID ${oldPublicId}`);
      }
    }

    await courseModel.findByIdAndDelete(id);

    return res.json({ message: "Delete Course success" });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const postContentCourse = async (req, res) => {
  try {
    const body = req.body;

    const course = await courseModel.findById(body.courseId);
    const content = new courseDetailModel({
      title: body.title,
      type: body.type,
      course: course._id,
      text: body.text,
      youtubeId: body.youtubeId,
    });

    await content.save();

    await courseModel.findByIdAndUpdate(
      course._id,
      {
        $push: {
          details: content._id,
        },
      },
      { new: true }
    );

    return res.json({ message: "Create Content success" });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const updateContentCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const course = await courseModel.findById(body.courseId);

    await courseDetailModel.findByIdAndUpdate(
      id,
      {
        title: body.title,
        type: body.type,
        course: course._id,
        text: body.text,
        youtubeId: body.youtubeId,
      },
      { new: true }
    );

    return res.json({ message: "Update Content success" });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const deleteContentCourse = async (req, res) => {
  try {
    const { id } = req.params;

    await courseDetailModel.findByIdAndDelete(id);

    return res.json({ message: "Delete content success" });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const getDetailContent = async (req, res) => {
  try {
    const { id } = req.params;
    const content = await courseDetailModel.findById(id);
    return res.json({
      message: "Get Detail Content success",
      data: content,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const getStudentsByCourseId = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await courseModel.findById(id).select("name").populate({
      path: "students",
      select: "name email photo",
    });
    // const photoUrl = process.env.APP_URL + "/uploads/students/";
    const studentsMap = course?.students?.map((item) => {
      return {
        ...item.toObject(),
        // photo_url: photoUrl + item.photo,
      };
    });
    return res.json({
      message: "Get Student by Course Success",
      data: {
        ...course.toObject(),
        students: studentsMap,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const postStudentToCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    await userModel.findByIdAndUpdate(body.studentId, {
      $push: {
        courses: id,
      },
    });

    await courseModel.findByIdAndUpdate(id, {
      $push: {
        students: body.studentId,
      },
    });

    return res.json({
      message: "Add student to course success",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const deleteStudentFromCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    await userModel.findByIdAndUpdate(body.studentId, {
      $pull: {
        courses: id,
      },
    });

    await courseModel.findByIdAndUpdate(id, {
      $pull: {
        students: body.studentId,
      },
    });

    return res.json({
      message: "Delete student from course success",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server error" });
  }
};
