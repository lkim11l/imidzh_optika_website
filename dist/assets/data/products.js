/**
 * Prototype fixtures only. Brands come from the supplied assortment list.
 * Model names, prices, attributes and unbranded images are illustrative.
 * @typedef {'optical'|'sunglasses'} Category
 * @typedef {'men'|'women'|'unisex'} Gender
 * @typedef {{src:string, alt:string}} ProductImage
 * @typedef {{id:string, slug:string, brand:string, model:string, category:Category,
 * gender:Gender, price:number, oldPrice?:number, isNew:boolean, isFeatured:boolean,
 * popularity:number, images:ProductImage[], shortDescription:string,
 * description:string, attributes:Record<string,string>, isMock:boolean}} Product
 */
export const brands = Object.freeze(['Silhouette', 'Chopard', 'Tom Ford', 'Dolce & Gabbana', 'Swarovski', 'Carrera', 'Moncler', 'Fendi', 'Versace', 'Ray-Ban', 'Miu Miu', 'Marc Jacobs', 'Police', "Tod’s", 'Ermenegildo Zegna', 'Renaissance']);
export const categoryLabels = Object.freeze({ optical: 'Оправы для зрения', sunglasses: 'Солнцезащитные очки' });
export const genderLabels = Object.freeze({ men: 'Мужские', women: 'Женские', unisex: 'Унисекс' });
// Explicit records make it easy to review or replace fixtures independently of UI.
const fixtures = [
  ['opt-01','tom-ford-forma-01','Tom Ford','Forma 01','optical','unisex',34900,null,true,true,98,'Прямоугольная','Черный','Ацетат'],
  ['opt-02','silhouette-linea-02','Silhouette','Linea 02','optical','unisex',42900,null,true,true,99,'Безободковая','Шампань','Металл'],
  ['opt-03','dolce-gabbana-forma-03','Dolce & Gabbana','Forma 03','optical','women',38900,44900,false,false,88,'Кошачий глаз','Черепаховый','Ацетат'],
  ['opt-04','renaissance-linea-04','Renaissance','Linea 04','optical','unisex',15900,null,false,false,78,'Круглая','Серебристый','Металл'],
  ['opt-05','ermenegildo-zegna-forma-05','Ermenegildo Zegna','Forma 05','optical','men',32900,null,false,false,85,'Прямоугольная','Темно-синий','Ацетат'],
  ['opt-06','swarovski-forma-06','Swarovski','Forma 06','optical','women',29900,null,true,false,82,'Овальная','Пудровый','Ацетат'],
  ['opt-07','chopard-linea-07','Chopard','Linea 07','optical','men',92900,null,false,false,93,'Авиатор','Серебристый','Металл'],
  ['opt-08','fendi-forma-08','Fendi','Forma 08','optical','women',46900,null,false,false,90,'Геометрическая','Янтарный','Ацетат'],
  ['opt-09','ray-ban-forma-09','Ray-Ban','Forma 09','optical','unisex',18900,null,true,false,96,'Прямоугольная','Прозрачный','Ацетат'],
  ['opt-10','miu-miu-forma-10','Miu Miu','Forma 10','optical','women',39900,null,false,false,87,'Кошачий глаз','Бордовый','Ацетат'],
  ['opt-11','police-forma-11','Police','Forma 11','optical','men',21900,25900,false,false,81,'Прямоугольная','Темно-зеленый','Ацетат'],
  ['opt-12','tods-forma-12','Tod’s','Forma 12','optical','unisex',35900,null,false,false,86,'Овальная','Коричневый','Ацетат'],
  ['sun-01','tom-ford-sole-01','Tom Ford','Sole 01','sunglasses','unisex',41900,null,true,true,97,'Прямоугольная','Черный','Ацетат'],
  ['sun-02','chopard-sole-02','Chopard','Sole 02','sunglasses','men',91900,null,false,true,100,'Авиатор','Золотистый','Металл'],
  ['sun-03','dolce-gabbana-sole-03','Dolce & Gabbana','Sole 03','sunglasses','women',37900,42900,false,false,90,'Кошачий глаз','Черепаховый','Ацетат'],
  ['sun-04','versace-sole-04','Versace','Sole 04','sunglasses','women',45900,null,true,false,92,'Крупная','Черный','Ацетат'],
  ['sun-05','carrera-sole-05','Carrera','Sole 05','sunglasses','men',22900,null,false,false,89,'Авиатор','Серебристый','Металл'],
  ['sun-06','marc-jacobs-sole-06','Marc Jacobs','Sole 06','sunglasses','unisex',28900,null,false,false,83,'Квадратная','Медовый','Ацетат'],
  ['sun-07','miu-miu-sole-07','Miu Miu','Sole 07','sunglasses','women',48900,null,true,false,94,'Овальная','Айвори','Ацетат'],
  ['sun-08','fendi-sole-08','Fendi','Sole 08','sunglasses','women',53900,null,false,false,91,'Бабочка','Коричневый','Ацетат'],
  ['sun-09','moncler-sole-09','Moncler','Sole 09','sunglasses','men',39900,null,true,false,88,'Спортивная','Темно-синий','Ацетат'],
  ['sun-10','ray-ban-sole-10','Ray-Ban','Sole 10','sunglasses','unisex',19900,null,false,false,95,'Квадратная','Темно-зеленый','Ацетат'],
  ['sun-11','swarovski-sole-11','Swarovski','Sole 11','sunglasses','women',31900,null,false,false,84,'Геометрическая','Розовый','Металл'],
  ['sun-12','police-sole-12','Police','Sole 12','sunglasses','men',24900,29900,false,false,80,'Прямоугольная','Черный','Ацетат']
];
/** @type {ReadonlyArray<Product>} */
export const mockProducts = Object.freeze(fixtures.map(([id,slug,brand,model,category,gender,price,oldPrice,isNew,isFeatured,popularity,shape,color,material], index) => {
  const imageNumber = String(index % 12 + 1).padStart(2, '0');
  const type = category === 'optical' ? 'Оправа' : 'Солнцезащитные очки';
  return Object.freeze({id, slug, brand, model, category, gender, price, ...(oldPrice ? {oldPrice} : {}), isNew, isFeatured, popularity,
    images: [{src:`/assets/products/${category}-${imageNumber}.webp`,alt:`${type}: ${shape.toLowerCase()} форма, ${color.toLowerCase()} оттенок. Иллюстрация демонстрационной модели ${model}`}],
    shortDescription:`Форма: ${shape.toLocaleLowerCase('ru')}. Цвет: ${color.toLocaleLowerCase('ru')}.`,
    description:category === 'optical' ? 'Выбор оправы начинается с посадки и ваших привычек. На примерке можно оценить форму, комфорт и сочетание с линзами.' : 'Солнцезащитные очки — часть повседневного стиля. На примерке можно сравнить формы и выбрать посадку, в которой вам комфортно.',
    attributes:{'Форма':shape,'Цвет':color,'Материал оправы':material}, isMock:true});
}));
