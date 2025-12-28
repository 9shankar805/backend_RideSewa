const AWS = require('aws-sdk');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

class FileService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.bucket = process.env.AWS_S3_BUCKET;
  }

  getMulterConfig() {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.'));
        }
      }
    });
  }

  async uploadFile(file, folder = 'uploads') {
    try {
      let processedBuffer = file.buffer;
      let contentType = file.mimetype;

      // Compress images
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await sharp(file.buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        contentType = 'image/jpeg';
      }

      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;

      const params = {
        Bucket: this.bucket,
        Key: fileName,
        Body: processedBuffer,
        ContentType: contentType,
        ACL: 'public-read'
      };

      const result = await this.s3.upload(params).promise();
      return {
        url: result.Location,
        key: result.Key,
        size: processedBuffer.length
      };
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async deleteFile(key) {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key
      }).promise();
      return true;
    } catch (error) {
      console.error('File deletion failed:', error);
      return false;
    }
  }

  async uploadProfileImage(file, userId) {
    return await this.uploadFile(file, `profiles/${userId}`);
  }

  async uploadDriverDocument(file, driverId, documentType) {
    return await this.uploadFile(file, `drivers/${driverId}/${documentType}`);
  }

  validateFileType(file, allowedTypes) {
    return allowedTypes.includes(file.mimetype);
  }

  generatePresignedUrl(key, expiresIn = 3600) {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn
    });
  }
}

module.exports = FileService;