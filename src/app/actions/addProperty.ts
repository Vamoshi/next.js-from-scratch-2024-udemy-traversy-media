"use server";

import cloudinary from "@/config/cloudinary";
import connectDB from "@/config/database";
import { IProperty, Property } from "@/models";
import { getDataAsString, parseOptionalNumber } from "@/utils/formatFormValues";
import { getSessionUser } from "@/utils/getSessionUser";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export default async function addProperty(formData: FormData) {
  await connectDB();

  const sessionUser = await getSessionUser();

  if (!sessionUser || !sessionUser.id) {
    throw new Error("User ID is required");
  }

  const amenities = formData.getAll("amenities");
  const images = formData
    .getAll("images")
    .filter(
      (image): image is File => image instanceof File && image.name !== ""
    );

  const imageUrls = [];

  for (const imageFile of images) {
    // converts File to ArrayBuffer which is a low-level binary representation of file
    const imageBuffer = await imageFile.arrayBuffer();
    // ArrayBuffer is then converted to a Uint8Array (array of 8-bit unsigned integers) to manipulate bin data
    // then Uint8Array is converted into regular js array
    const imageArray = Array.from(new Uint8Array(imageBuffer));
    // then convert to Node.js Buffer object which will allow efficient binary handling in Node.js
    const imageData = Buffer.from(imageArray);

    // detect file type dynamically
    const mimeType = imageFile.type; // imageFile.type contains the MIME type of the file
    // convert image to b64/ASCII characters
    const imageB64 = imageData.toString("base64");

    // Request to cloudinary
    const result = await cloudinary.uploader.upload(
      `data:${mimeType};base64,${imageB64}`,
      { folder: "propertypulse" }
    );

    imageUrls.push(result.secure_url);
  }

  const propertyData: IProperty = {
    owner: sessionUser.id,
    name: getDataAsString(formData, "name"),
    type: getDataAsString(formData, "type"),
    location: {
      street: getDataAsString(formData, "location.street"),
      city: getDataAsString(formData, "location.city"),
      state: getDataAsString(formData, "location.state"),
      zipcode: getDataAsString(formData, "location.zipcode"),
    },
    // putting + before a string number converts to number
    beds: +getDataAsString(formData, "beds"),
    baths: +getDataAsString(formData, "baths"),
    square_feet: +getDataAsString(formData, "square_feet"),
    description: getDataAsString(formData, "description"),
    amenities: amenities as string[],
    rates: {
      nightly: parseOptionalNumber(formData, "rates.nightly"),
      weekly: parseOptionalNumber(formData, "rates.weekly"),
      monthly: parseOptionalNumber(formData, "rates.monthly"),
    },
    seller_info: {
      name: getDataAsString(formData, "seller_info.name"),
      email: getDataAsString(formData, "seller_info.email"),
      phone: getDataAsString(formData, "seller_info.phone"),
    },
    images: imageUrls,
  };

  const newProperty = new Property(propertyData);
  await newProperty.save();
  revalidatePath("/", "layout");
  redirect(`/properties/${newProperty._id}`);
}
