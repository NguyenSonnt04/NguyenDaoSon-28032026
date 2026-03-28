var express = require("express");
var router = express.Router();
let { uploadImage, uploadExcel } = require('../utils/uploadHandler')
let path = require('path')
let exceljs = require('exceljs')
let categoryModel = require('../schemas/categories')
let productModel = require('../schemas/products')
let inventoryModel = require('../schemas/inventories')
let mongoose = require('mongoose')
let slugify = require('slugify')
let crypto = require('crypto')
let userModel = require('../schemas/users')
let roleModel = require('../schemas/roles')
let { sendWelcomeEmail } = require('../utils/mailHandler')

router.get('/:filename', function (req, res, next) {
    let pathFile = path.join(__dirname, '../uploads', req.params.filename)
    res.sendFile(pathFile)
})

router.post('/one_file', uploadImage.single('file'), function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file khong duoc de trong"
        })
        return
    }
    res.send({
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
    })
})
router.post('/multiple_file', uploadImage.array('files'), function (req, res, next) {
    if (!req.files) {
        res.status(404).send({
            message: "file khong duoc de trong"
        })
        return
    }
    res.send(req.files.map(f => {
        return {
            filename: f.filename,
            path: f.path,
            size: f.size
        }
    }))
})
router.post('/excel', uploadExcel.single('file'), async function (req, res, next) {
    //workbook->worksheet->row/column->cell
    let workbook = new exceljs.Workbook();
    let pathFile = path.join(__dirname, '../uploads', req.file.filename)
    await workbook.xlsx.readFile(pathFile);
    let worksheet = workbook.worksheets[0];
    let categories = await categoryModel.find({});
    let categoryMap = new Map()
    for (const category of categories) {
        categoryMap.set(category.name, category._id)
    }
    let products = await productModel.find({});
    let getTitle = products.map(p => p.title)
    let getSku = products.map(p => p.sku)
    let result = [];
    for (let row = 2; row <= worksheet.rowCount; row++) {
        let errorsInRow = [];
        const contentRow = worksheet.getRow(row);
        let sku = contentRow.getCell(1).value;
        let title = contentRow.getCell(2).value;
        let category = contentRow.getCell(3).value;
        let price = Number.parseInt(contentRow.getCell(4).value);
        let stock = Number.parseInt(contentRow.getCell(5).value);
        if (price < 0 || isNaN(price)) {
            errorsInRow.push("price pahi la so duong")
        }
        if (stock < 0 || isNaN(stock)) {
            errorsInRow.push("stock pahi la so duong")
        }
        if (!categoryMap.has(category)) {
            errorsInRow.push("category khong hop le")
        }
        if (getTitle.includes(title)) {
            errorsInRow.push("Title da ton tai")
        }
        if (getSku.includes(sku)) {
            errorsInRow.push("sku da ton tai")
        }
        if (errorsInRow.length > 0) {
            result.push(errorsInRow)
            continue;
        }
        let session = await mongoose.startSession();
        session.startTransaction()
        try {
            let newProduct = new productModel({
                sku: sku,
                title: title,
                slug: slugify(title,
                    {
                        replacement: '-',
                        remove: undefined,
                        lower: true,
                        trim: true
                    }
                ), price: price,
                description: title,
                category: categoryMap.get(category)
            })
            await newProduct.save({ session });

            let newInventory = new inventoryModel({
                product: newProduct._id,
                stock: stock
            })
            await newInventory.save({ session });
            await newInventory.populate('product')
            await session.commitTransaction()
            await session.endSession()
            getTitle.push(newProduct.title)
            getSku.push(newProduct.sku)
            result.push(newInventory)
        } catch (error) {
            await session.abortTransaction()
            await session.endSession()
            res.push(error.message)
        }

    }
    res.send(result)
})

// Helper: tạo chuỗi password ngẫu nhiên 16 ký tự
function generatePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += chars[bytes[i] % chars.length];
    }
    return password;
}

// POST /api/v1/upload/excel/users - Import users từ file Excel
router.post('/excel/users', uploadExcel.single('file'), async function (req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'Vui lòng chọn file Excel' });
        }

        // Đọc file Excel
        let workbook = new exceljs.Workbook();
        let pathFile = path.join(__dirname, '../uploads', req.file.filename);
        await workbook.xlsx.readFile(pathFile);
        let worksheet = workbook.worksheets[0];

        // Tìm role "user" trong DB
        let userRole = await roleModel.findOne({ name: 'user' });
        if (!userRole) {
            return res.status(400).send({ message: 'Role "user" không tồn tại trong hệ thống. Vui lòng tạo role trước.' });
        }

        let result = [];

        // Đọc từng dòng, bỏ qua dòng tiêu đề (row 1)
        for (let row = 2; row <= worksheet.rowCount; row++) {
            const contentRow = worksheet.getRow(row);
            
            // Lấy trực tiếp dưới dạng chuỗi thông qua hàm toString() hoặc `.text` của ExcelJS
            let cell1 = contentRow.getCell(1);
            let cell2 = contentRow.getCell(2);
            
            let username = cell1.value ? cell1.toString() : '';
            let email = cell2.value ? cell2.toString() : '';

            // Nếu lấy ra có chứa hyperlink object kiểu JSON, parsing lại:
            if (cell1.value && typeof cell1.value === 'object') {
                username = cell1.value.text || cell1.value.hyperlink || username;
            }
            if (cell2.value && typeof cell2.value === 'object') {
                email = cell2.value.text || cell2.value.hyperlink || email;
            }

            // Bỏ qua dòng trống
            if (!username || !email) {
                result.push({ row, status: 'skip', message: 'Dòng trống, bỏ qua' });
                continue;
            }

            username = String(username).trim();
            email = String(email).trim().toLowerCase();

            // Kiểm tra trùng lặp
            let existing = await userModel.findOne({ $or: [{ username }, { email }] });
            if (existing) {
                result.push({ row, username, email, status: 'error', message: 'Username hoặc email đã tồn tại' });
                continue;
            }

            // Tạo password ngẫu nhiên 16 ký tự
            let rawPassword = generatePassword(16);

            try {
                // Tạo user mới
                let newUser = new userModel({
                    username,
                    email,
                    password: rawPassword,
                    role: userRole._id,
                    status: true
                });
                await newUser.save();

                // Gửi email thông báo (không block nếu lỗi mail)
                try {
                    await sendWelcomeEmail(email, username, rawPassword);
                    result.push({ row, username, email, status: 'success', message: 'Tạo user và gửi email thành công' });
                } catch (mailErr) {
                    result.push({ row, username, email, status: 'success_no_mail', message: 'Tạo user thành công nhưng gửi email thất bại: ' + mailErr.message });
                }
            } catch (err) {
                result.push({ row, username, email, status: 'error', message: err.message });
            }
        }

        res.send({
            total: result.length,
            success: result.filter(r => r.status.startsWith('success')).length,
            failed: result.filter(r => r.status === 'error').length,
            details: result
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router