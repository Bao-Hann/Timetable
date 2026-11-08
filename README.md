# Nhịp

Một khoảng lặng để sắp xếp ngày của bạn.

Ứng dụng lịch trình cá nhân với giao diện tối giản: nền giấy ngà, typography serif, màu pastel trầm và timeline theo giờ.

Web: [Nhịp — lịch trình cá nhân](https://bao-hann.github.io/Timetable/)

Repo: [Bao-Hann/Timetable](https://github.com/Bao-Hann/Timetable)

## Tính năng

- Mở bằng lịch tổng quan **tháng hiện tại**, theo ngày giờ địa phương của trình duyệt; tuần bắt đầu từ thứ Hai.
- Bấm một ngày để xem timeline công việc, tự động sắp xếp theo giờ.
- Xem nhanh ngày tiếp theo và **tuần tới**: thứ Hai–Chủ nhật của tuần kế tiếp, có hiển thị khoảng ngày.
- Lọc theo nhóm Học tập, Câu lạc bộ, Khởi nghiệp, Cá nhân; hoặc lọc việc chờ duyệt.
- Công việc mới luôn ở trạng thái **Pending — Chờ duyệt**. Bấm **Duyệt** để chuyển sang **Approved — Chính thức**.
- Chỉnh sửa công việc đưa trạng thái về chờ duyệt.
- Xóa công việc và hoàn tác thao tác xóa.
- Xuất JSON để sao lưu dữ liệu và **nhập lại bản sao** để khôi phục lịch. Tệp được kiểm tra trước khi nhập; nếu đang có công việc riêng, ứng dụng yêu cầu xác nhận trước khi thay thế.

Lần đầu mở ứng dụng có lịch mẫu được gắn nhãn rõ ràng. Lịch mẫu chỉ tồn tại trong bộ nhớ. Khi tạo công việc thật đầu tiên, ứng dụng chuyển sang lịch cá nhân sạch, không trộn dữ liệu mẫu.

## Công nghệ

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Lucide Icons.

## Chạy trên máy

Yêu cầu **Node.js từ 22.12 trở lên** và npm.

```sh
npm ci
npm run dev
```

Mở địa chỉ mà Vite in trong terminal.

## Kiểm tra và build

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` tạo bản triển khai trong thư mục `dist/`.

**Đã xác minh:** 36 bài kiểm tra (29 unit + 7 integration), TypeScript và production build đều thành công. Kiểm tra tương tác chạy trong jsdom; chưa xác minh trực quan trên trình duyệt desktop/mobile.

## Lưu trữ và sao lưu

Dữ liệu cá nhân được lưu bằng `localStorage`, với khóa `nhip.timetable.v1`, trên trình duyệt và thiết bị đang sử dụng. Tải lại trang vẫn giữ công việc và trạng thái duyệt.

Ứng dụng hiện chưa có máy chủ, tài khoản, đồng bộ nhiều thiết bị hay thông báo nhắc lịch. Xóa dữ liệu trình duyệt hoặc dùng cửa sổ riêng tư có thể làm mất lịch; nên xuất JSON định kỳ. Để khôi phục, chọn **Nhập bản sao JSON** ở cuối trang, chọn tệp `.json` đã xuất từ Nhịp và xác nhận nếu muốn thay thế lịch hiện có. Tệp sai định dạng hoặc không hợp lệ sẽ bị từ chối, không thay đổi lịch hiện tại. Giới hạn tệp 10 MB.

Nếu không đọc được dữ liệu lưu trữ hoặc dữ liệu bị hỏng, ứng dụng hiển thị cảnh báo và giữ nguyên dữ liệu gốc, không tự ghi đè. Những thay đổi trong phiên tạm có thể không được lưu sau khi đóng trang.

## Triển khai

```sh
npm run build
```

Triển khai nội dung `dist/` lên dịch vụ hosting tĩnh. Cấu hình Vite dùng `base: './'` để hỗ trợ cả đường dẫn con như `/Timetable/`.

Repo có sẵn hai workflow GitHub Actions:

- **Check timetable:** chạy test, kiểm tra TypeScript và build khi push hoặc mở pull request; lưu artifact `timetable-static`.
- **Publish GitHub Pages:** tự động kiểm tra, build và triển khai mỗi lần cập nhật `main`; cũng có thể chạy thủ công từ tab Actions. Nếu test hoặc build lỗi, quy trình dừng trước bước deploy. Workflow cũng dừng tác vụ Pages cũ xuất bản trực tiếp mã nguồn (nếu còn bật), để tránh ghi đè ứng dụng đã build.

Để bật web trên GitHub Pages:

1. Đưa mã nguồn này lên nhánh `main` của `Bao-Hann/Timetable`.
2. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
3. Push hoặc merge mã vào `main` để tự động triển khai. Khi muốn triển khai lại, vào **Actions → Publish GitHub Pages → Run workflow**, chọn `main`.
4. Khi workflow thành công, mở URL trong bước deploy hoặc trang **Settings → Pages**.

Không đưa `node_modules/` lên hosting. Font Inter và Lora được đóng gói cùng bản build, không phụ thuộc Google Fonts khi chạy.

## Nếu gặp lỗi, quay lại bước trước

1. Dừng ở bước lỗi và đọc thông báo lỗi đầu tiên trong terminal.
2. Nếu lỗi cài đặt, kiểm tra phiên bản Node rồi quay lại `npm install`.
3. Nếu lỗi kiểm tra hoặc build, sửa lỗi được báo rồi chạy lại đúng lệnh đó. Chỉ triển khai sau khi build thành công.
4. Nếu lỗi sau khi triển khai, quay lại bản build đã hoạt động trước đó và kiểm tra lại cấu hình hosting.

Commit ban đầu `c12a6f0` được giữ trong lịch sử Git. Khi cần hoàn tác một thay đổi đã đưa lên repo, dùng `git revert <commit-cần-hoàn-tác>` để tạo commit hoàn tác và bảo toàn lịch sử. Không dùng `git reset --hard` để xử lý lỗi thông thường.
